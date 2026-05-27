// Engångsskript — verifierar STEG 1 backend-fix (län + postort + kommun).
// Importerar ALL_KOMMUNER och kommunCodesForLan från lan.ts indirekt via
// regex-parse på kommuner.ts (samma trick som scripts/fetch-stats.mjs)
// så vi slipper tsx-kompilering.
//
// Kör: node --env-file=.env.local scripts/test-area-filter.mjs
import { readFileSync } from "node:fs";

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://ymqbimerrvycbknstsai.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!KEY) {
  console.error("Sätt NEXT_PUBLIC_SUPABASE_ANON_KEY (kör med --env-file=.env.local)");
  process.exit(1);
}

// Parsa kommuner.ts → bygg kommun→län-mappning (samma logik som lan.ts kör)
const kommunerSrc = readFileSync(
  new URL("../src/lib/kommuner.ts", import.meta.url),
  "utf8",
);
const lanByKommunCode = new Map();
for (const m of kommunerSrc.matchAll(/\["(\d{4})",\s*"([^"]+)"\]/g)) {
  const scb = m[1];
  const code = scb.replace(/^0+/, "") || "0";
  const lanCode = scb.slice(0, 2).replace(/^0+/, "") || "0";
  lanByKommunCode.set(code, lanCode);
}

function kommunCodesForLan(lanCode) {
  const normalized = lanCode.replace(/^0+/, "") || "0";
  const codes = [];
  for (const [k, l] of lanByKommunCode.entries()) {
    if (l === normalized) codes.push(k);
  }
  return codes;
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function count(filterParams) {
  const url = `${SUPA_URL}/rest/v1/foretag_publik?${filterParams}&limit=1`;
  const r = await fetch(url, {
    method: "HEAD",
    headers: { ...headers, Prefer: "count=exact" },
  });
  if (!r.ok) {
    console.error("REST-fel", r.status, await r.text().catch(() => ""));
    return -1;
  }
  const range = r.headers.get("content-range");
  return parseInt(range?.split("/")[1] ?? "0", 10);
}

async function main() {
  const sthlmKommuner = kommunCodesForLan("1");
  console.log("Stockholms län enligt kommuner.ts:", sthlmKommuner.length, "kommuner");
  console.log("  ", sthlmKommuner.join(", "));
  console.log();

  // Mirror av applyGeoFilter's tre branches:
  const sthlmKommun = await count(`ng1=eq.43210&kommun=eq.180`);
  const sthlmLan = await count(
    `ng1=eq.43210&kommun=in.(${sthlmKommuner.join(",")})`,
  );
  const solna = await count(`ng1=eq.43210&kommun=eq.184`);
  const bromma = await count(`ng1=eq.43210&postort=ilike.Bromma`);
  const tabyKommun = await count(`ng1=eq.43210&kommun=eq.160`);
  const sthlmLanViaLanColumn = await count(`ng1=eq.43210&lan=eq.1`);

  console.log("ng1=43210 (Elektriker)");
  console.log("  kommun=180 (Sthlm kommun):                ", sthlmKommun);
  console.log("  lan=stockholm (kommun-IN, vår strategi):  ", sthlmLan);
  console.log("  lan=stockholm via lan-kolumn (referens):  ", sthlmLanViaLanColumn);
  console.log("  kommun=184 (Solna):                       ", solna);
  console.log("  kommun=160 (Täby):                        ", tabyKommun);
  console.log("  postort=Bromma:                           ", bromma);
  console.log();
  console.log("Bekräftelse:");
  console.log("  Stockholm KOMMUN → LÄN-fönster:", sthlmKommun, "→", sthlmLan, `(${((sthlmLan/sthlmKommun)).toFixed(1)}×)`);
  console.log("  kommun-IN vs lan-kolumn diff:  ", sthlmLan - sthlmLanViaLanColumn, "extra firmor fångade tack vare kommun→län-mappning");
}

main();
