// Engångsskript — räknar hantverksföretag totalt + per hantverks-branschid +
// per kommun + per kategori. Resultat skrivs till stdout som JSON och kan
// klistras in i src/lib/stats.ts samt src/lib/hantverk-kategorier.ts.
//
// Kör: node scripts/fetch-hantverk-stats.mjs > /tmp/hantverk-stats.json
import { readFileSync } from "node:fs";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://ymqbimerrvycbknstsai.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_ANON_KEY in env");
  process.exit(1);
}

// Läs hantverks-branscher från TS-källan så vi inte duplicerar listan här.
const hantverkSrc = readFileSync(
  new URL("../src/lib/hantverk-branscher.ts", import.meta.url),
  "utf8",
);
const HANTVERK_BRANSCHER = [];
const inListMatch = hantverkSrc.match(/export const HANTVERK_BRANSCHER[^=]*=\s*\[([\s\S]*?)\];/);
if (!inListMatch) {
  console.error("Could not parse HANTVERK_BRANSCHER from hantverk-branscher.ts");
  process.exit(1);
}
for (const line of inListMatch[1].split("\n")) {
  const code = line.replace(/\/\/.*$/, "").trim();
  const m = code.match(/^(\d+)\s*,?$/);
  if (m) HANTVERK_BRANSCHER.push(Number(m[1]));
}

// Läs kategorier för att räkna per-kategori-totals.
const katSrc = readFileSync(
  new URL("../src/lib/hantverk-kategorier.ts", import.meta.url),
  "utf8",
);
const KATEGORIER = [];
{
  // Mycket enkel parser — hittar { slug: "x", ng1: [..] }-block.
  const blocks = katSrc.match(/\{\s*slug:\s*"[^"]+",[\s\S]*?\},/g) ?? [];
  for (const b of blocks) {
    const slugM = b.match(/slug:\s*"([^"]+)"/);
    const nameM = b.match(/name:\s*"([^"]+)"/);
    const ngM = b.match(/ng1:\s*\[([^\]]+)\]/);
    if (!slugM || !ngM) continue;
    const ng1 = ngM[1]
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    KATEGORIER.push({ slug: slugM[1], name: nameM?.[1] ?? slugM[1], ng1 });
  }
}

// Kommuner — samma parsning som fetch-stats.mjs.
const kommunerSrc = readFileSync(
  new URL("../src/lib/kommuner.ts", import.meta.url),
  "utf8",
);
const kommuner = [];
for (const m of kommunerSrc.matchAll(/\["(\d{3,4})",\s*"([^"]+)"\]/g)) {
  const scb = m[1];
  const name = m[2];
  const code = scb.replace(/^0+/, "") || "0";
  kommuner.push({ code, scb, name });
}

const branschCsv = HANTVERK_BRANSCHER.join(",");

async function countHead(url) {
  const r = await fetch(url, {
    method: "HEAD",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Prefer: "count=estimated",
    },
  });
  const cr = r.headers.get("content-range") ?? "";
  const m = cr.match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

async function fetchHantverkBranschNames() {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/t_bransch?select=branschid,beskrivning&branschid=in.(${branschCsv})&limit=200`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  );
  if (!r.ok) throw new Error(`t_bransch ${r.status}`);
  return r.json();
}

async function countTotalHantverk() {
  return countHead(
    `${SUPA_URL}/rest/v1/foretag_publik?select=id&ng1=in.(${branschCsv})&limit=1`,
  );
}

async function countForBransch(id) {
  return countHead(
    `${SUPA_URL}/rest/v1/foretag_publik?select=id&ng1=eq.${id}&limit=1`,
  );
}

async function countForKommun(code) {
  return countHead(
    `${SUPA_URL}/rest/v1/foretag_publik?select=id&kommun=eq.${encodeURIComponent(code)}&ng1=in.(${branschCsv})&limit=1`,
  );
}

async function countForKategori(ng1List) {
  return countHead(
    `${SUPA_URL}/rest/v1/foretag_publik?select=id&ng1=in.(${ng1List.join(",")})&limit=1`,
  );
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

console.error(
  `Fetching stats for ${HANTVERK_BRANSCHER.length} hantverks-branscher, ` +
    `${KATEGORIER.length} kategorier, ${kommuner.length} kommuner...`,
);

const [total, branschNames, branschCounts, kategoriCounts, kommunCounts] =
  await Promise.all([
    countTotalHantverk(),
    fetchHantverkBranschNames(),
    mapLimit(HANTVERK_BRANSCHER, 8, countForBransch),
    mapLimit(KATEGORIER, 6, (k) => countForKategori(k.ng1)),
    mapLimit(kommuner, 12, (k) => countForKommun(k.code)),
  ]);

const nameById = new Map(
  branschNames.map((r) => [r.branschid, r.beskrivning ?? `SNI ${r.branschid}`]),
);

const branscher = HANTVERK_BRANSCHER
  .map((id, i) => ({
    id,
    name: nameById.get(id) ?? `SNI ${id}`,
    count: branschCounts[i] ?? 0,
  }))
  .sort((a, b) => b.count - a.count);

const kommunerSorted = kommuner
  .map((k, i) => ({ code: k.code, name: k.name, count: kommunCounts[i] ?? 0 }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 25);

const kategorier = KATEGORIER.map((k, i) => ({
  slug: k.slug,
  name: k.name,
  count: kategoriCounts[i] ?? 0,
})).sort((a, b) => b.count - a.count);

const kommunerWithAny = kommuner
  .map((k, i) => ({ code: k.code, count: kommunCounts[i] ?? 0 }))
  .filter((r) => r.count > 0).length;

console.log(
  JSON.stringify(
    {
      generated: new Date().toISOString().slice(0, 10),
      total,
      kommunerWithAny,
      branscher,
      kategorier,
      kommuner: kommunerSorted,
    },
    null,
    2,
  ),
);
