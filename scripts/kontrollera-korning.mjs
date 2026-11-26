// Dödmansgrepp för den dagliga körningen (beslut 2026-11-25).
//
//   node --env-file=.env.local scripts/kontrollera-korning.mjs [--timmar 48]
//
// Läser körloggen hantverk_korning och avslutar med kod 1 om något av de två
// skripten (pafyllning, steg2) saknar en körning med status "klar" inom de
// senaste timmarna. Skriver de senaste körningarna, så att orsaken syns i
// GitHub Actions-loggen. Läser bara; skriver ingenting.

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NYCKEL = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !NYCKEL) {
  console.error("NEXT_PUBLIC_SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY behövs.");
  process.exit(1);
}
const i = process.argv.indexOf("--timmar");
const TIMMAR = i > 0 ? Number(process.argv[i + 1]) : 48;
const sedan = new Date(Date.now() - TIMMAR * 3600_000).toISOString();

const res = await fetch(
  `${SUPA}/rest/v1/hantverk_korning?select=id,skript,startad,klar,status,visade_fore,visade_efter,doljs,orsak&order=id.desc&limit=10`,
  { headers: { apikey: NYCKEL, Authorization: `Bearer ${NYCKEL}` } },
);
if (!res.ok) {
  console.error(`hantverk_korning svarade ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const rader = await res.json();
console.log("Senaste körningarna:");
for (const r of rader) {
  console.log(`  ${r.id} ${r.skript} ${r.startad} → ${r.status}${r.orsak ? ` (${r.orsak})` : ""} visade ${r.visade_fore} → ${r.visade_efter}, döljs ${r.doljs}`);
}

let fel = false;
for (const skript of ["pafyllning", "steg2"]) {
  const senast = rader.find((r) => r.skript === skript && r.status === "klar" && r.startad >= sedan);
  if (senast) console.log(`${skript}: senast klar ${senast.startad}`);
  else {
    console.error(`${skript}: ingen körning med status klar de senaste ${TIMMAR} timmarna.`);
    fel = true;
  }
}
process.exit(fel ? 1 : 0);
