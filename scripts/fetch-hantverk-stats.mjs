// Snapshot-generator för Hantverkardelen.
//
// Räknar hantverksföretag totalt, per bransch, per kommun, per kategori och
// per (kommun × bransch). Resultatet skrivs som JSON till stdout och matas
// in i src/lib/stats.ts, src/lib/hantverk-kategorier.ts och
// src/lib/seo-snapshot.ts av scripts/apply-snapshot.mjs.
//
// Kör: node scripts/fetch-hantverk-stats.mjs > /tmp/hantverk-stats.json
//
// VIKTIGT — count=estimated får INTE användas här. PostgREST räknar då exakt
// bara upp till max_rows (1000) och returnerar annars 1001, eller planerarens
// gissning (Stockholm: 9377 mot exakt 5599). Det var källan till de
// fabricerade "1 001" som låg publicerade på sajten fram till 2026-09-07.
// Vi läser istället hela (kommun, ng1)-histogrammet sida för sida, vilket ger
// exakta tal för varenda kombination i ett svep.
import { readFileSync } from "node:fs";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPA_URL || !KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/** PostgREST kapar varje svar här. Allt paging måste utgå från detta tal. */
const MAX_ROWS = 1000;

function readSrc(rel) {
  return readFileSync(new URL(`../src/lib/${rel}`, import.meta.url), "utf8");
}

// ---- Läs whitelist, kategorier och kommuner ur TS-källorna -----------------

const hantverkSrc = readSrc("hantverk-branscher.ts");
const listMatch = hantverkSrc.match(
  /export const HANTVERK_BRANSCHER[^=]*=\s*\[([\s\S]*?)\];/,
);
if (!listMatch) {
  console.error("Kunde inte parsa HANTVERK_BRANSCHER");
  process.exit(1);
}
const HANTVERK_BRANSCHER = [];
for (const line of listMatch[1].split("\n")) {
  const m = line.replace(/\/\/.*$/, "").trim().match(/^(\d+)\s*,?$/);
  if (m) HANTVERK_BRANSCHER.push(Number(m[1]));
}

const katSrc = readSrc("hantverk-kategorier.ts");
const KATEGORIER = [];
for (const b of katSrc.match(/\{\s*slug:\s*"[^"]+",[\s\S]*?\},/g) ?? []) {
  const slug = b.match(/slug:\s*"([^"]+)"/);
  const name = b.match(/name:\s*"([^"]+)"/);
  const ng = b.match(/ng1:\s*\[([^\]]+)\]/);
  if (!slug || !ng) continue;
  KATEGORIER.push({
    slug: slug[1],
    name: name?.[1] ?? slug[1],
    ng1: ng[1].split(",").map((s) => Number(s.trim())).filter(Number.isFinite),
  });
}

const kommunerSrc = readSrc("kommuner.ts");
const kommuner = [];
const seenScb = new Set();
for (const m of kommunerSrc.matchAll(/\["(\d{3,4})",\s*"([^"]+)"\]/g)) {
  if (seenScb.has(m[1])) continue;
  seenScb.add(m[1]);
  kommuner.push({ code: m[1].replace(/^0+/, "") || "0", scb: m[1], name: m[2] });
}

const branschCsv = HANTVERK_BRANSCHER.join(",");

// ---- Exakt count via head+count -------------------------------------------

async function countExact(qs) {
  const r = await fetch(`${SUPA_URL}/rest/v1/foretag_publik?${qs}&limit=1`, {
    method: "HEAD",
    headers: { ...H, Prefer: "count=exact" },
  });
  if (!r.ok) throw new Error(`count ${r.status} för ${qs}`);
  const m = (r.headers.get("content-range") ?? "").match(/\/(\d+)$/);
  if (!m) throw new Error(`saknar content-range för ${qs}`);
  return Number(m[1]);
}

// ---- Räkning per kommun och bransch ---------------------------------------
//
// Tidigare läste den här filen hela (kommun, ng1)-mängden sida för sida med
// offset och summerade i JS. Det gav fel: `id` är INTE unikt i vyn
// (foretag_publik: 1005 rader på ng1=43342 men bara 948 distinkta id), så
// `order=id.asc` har lika värden och offset-paginering över sidgränser både
// dubblerar och tappar rader. Radantalet stämde ändå mot totalen, så felet
// syntes inte — det gav bara tyst skeva tal (Trädgård 1714 istället för 1689).
//
// Nu ställs istället en head+count-fråga per kombination. Långsammare, men
// varje tal är ett exakt count(*) från databasen. Invarianten längst ner
// kontrollerar dessutom att branschtalen summerar till kommuntotalen.

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      for (let i = cursor++; i < items.length; i = cursor++) {
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

async function fetchBranschNames() {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/t_bransch?select=branschid,beskrivning&branschid=in.(${branschCsv})&limit=200`,
    { headers: H },
  );
  if (!r.ok) throw new Error(`t_bransch ${r.status}`);
  return r.json();
}

// ---- Kör -------------------------------------------------------------------

console.error(
  `Räknar ${HANTVERK_BRANSCHER.length} branscher, ${KATEGORIER.length} kategorier, ` +
    `${kommuner.length} kommuner...`,
);

const total = await countExact(`select=id&ng1=in.(${branschCsv})`);
console.error(`Exakt total: ${total}. Räknar per kommun och bransch...`);

const branschNames = await fetchBranschNames();

// Ett count per kommun.
const kommunTotals = await mapLimit(kommuner, 12, (k) =>
  countExact(`select=id&kommun=eq.${encodeURIComponent(k.code)}&ng1=in.(${branschCsv})`),
);

// Ett count per bransch.
const branschTotals = await mapLimit(HANTVERK_BRANSCHER, 12, (id) =>
  countExact(`select=id&ng1=eq.${id}`),
);

// Ett count per (kommun × bransch). Kommuner utan träffar hoppas över helt.
const pairJobs = [];
kommuner.forEach((k, ki) => {
  if ((kommunTotals[ki] ?? 0) === 0) return;
  for (const ng1 of HANTVERK_BRANSCHER) pairJobs.push({ k, ki, ng1 });
});
console.error(`  ${pairJobs.length} kommun×bransch-kombinationer...`);
let done = 0;
const pairCounts = await mapLimit(pairJobs, 12, async (job) => {
  const n = await countExact(
    `select=id&kommun=eq.${encodeURIComponent(job.k.code)}&ng1=eq.${job.ng1}`,
  );
  if (++done % 1000 === 0) console.error(`  ...${done}/${pairJobs.length}`);
  return n;
});

const nameById = new Map(
  branschNames.map((r) => [r.branschid, r.beskrivning ?? `SNI ${r.branschid}`]),
);

const branscher = HANTVERK_BRANSCHER.map((id, i) => ({
  id,
  name: nameById.get(id) ?? `SNI ${id}`,
  count: branschTotals[i] ?? 0,
})).sort((a, b) => b.count - a.count || a.id - b.id);

const kommunerAll = kommuner
  .map((k, i) => ({ code: k.code, name: k.name, count: kommunTotals[i] ?? 0 }))
  .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

const branschTotalById = new Map(HANTVERK_BRANSCHER.map((id, i) => [id, branschTotals[i] ?? 0]));
const kategorier = KATEGORIER.map((k) => ({
  slug: k.slug,
  name: k.name,
  count: k.ng1.reduce((sum, n) => sum + (branschTotalById.get(n) ?? 0), 0),
})).sort((a, b) => b.count - a.count);

const kommunBransch = {};
const perKommunSum = new Map();
pairJobs.forEach((job, i) => {
  const n = pairCounts[i] ?? 0;
  perKommunSum.set(job.k.code, (perKommunSum.get(job.k.code) ?? 0) + n);
  if (n > 0) (kommunBransch[job.k.code] ??= {})[job.ng1] = n;
});

// INVARIANT: branscherna partitionerar whitelisten och varje rad har exakt ett
// ng1, så branschtalen för en kommun måste summera till kommunens total.
// Går det inte ihop är någon räkning fel och inget får publiceras.
const avvikelser = [];
kommuner.forEach((k, i) => {
  const total = kommunTotals[i] ?? 0;
  if (total === 0) return;
  const summa = perKommunSum.get(k.code) ?? 0;
  if (summa !== total) avvikelser.push(`${k.name} (${k.code}): summa ${summa} != total ${total}`);
});
if (avvikelser.length > 0) {
  console.error("AVBRYTER — branschtalen summerar inte till kommuntotalen:");
  for (const a of avvikelser.slice(0, 20)) console.error("  " + a);
  process.exit(1);
}
console.error(`Invariant OK för ${kommuner.length} kommuner.`);

const kommunSummaTotalt = [...perKommunSum.values()].reduce((a, b) => a + b, 0);
if (kommunSummaTotalt !== total) {
  console.error(
    `NOTIS: kommunerna summerar till ${kommunSummaTotalt} av ${total} — ` +
      `${total - kommunSummaTotalt} rader har en kommunkod utanför de 290.`,
  );
}

console.log(
  JSON.stringify(
    {
      generated: new Date().toISOString().slice(0, 10),
      countMode: "exact",
      total,
      kommunerWithAny: kommunerAll.filter((k) => k.count > 0).length,
      branscher,
      kategorier,
      kommuner: kommunerAll,
      kommunBransch,
    },
    null,
    2,
  ),
);
console.error("Klart.");
