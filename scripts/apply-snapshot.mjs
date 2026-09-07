// Skriver in JSON:en från fetch-hantverk-stats.mjs i TS-källorna.
//
//   node scripts/fetch-hantverk-stats.mjs > /tmp/hantverk-stats.json
//   node scripts/apply-snapshot.mjs /tmp/hantverk-stats.json
//
// Rör tre filer:
//   src/lib/seo-snapshot.ts     — genererad i sin helhet
//   src/lib/stats.ts            — TOTAL_* och de två RAW-listorna
//   src/lib/hantverk-kategorier.ts — enbart count-fälten
import { readFileSync, writeFileSync } from "node:fs";

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("Ange sökväg till JSON från fetch-hantverk-stats.mjs");
  process.exit(1);
}
const snap = JSON.parse(readFileSync(jsonPath, "utf8"));

if (snap.countMode !== "exact") {
  console.error(`AVBRYTER: countMode är "${snap.countMode}", måste vara "exact".`);
  process.exit(1);
}

const src = (rel) => new URL(`../src/lib/${rel}`, import.meta.url);

// ---- 1. seo-snapshot.ts ----------------------------------------------------

const kommunCounts = Object.fromEntries(
  snap.kommuner.map((k) => [k.code, k.count]),
);
const pairLines = Object.entries(snap.kommunBransch)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([kommun, byNg1]) => {
    const inner = Object.entries(byNg1)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([ng1, n]) => `${ng1}: ${n}`)
      .join(", ");
    return `  "${kommun}": { ${inner} },`;
  })
  .join("\n");

writeFileSync(
  src("seo-snapshot.ts"),
  `/**
 * GENERERAD FIL — redigera inte för hand.
 *
 * Skapad av scripts/fetch-hantverk-stats.mjs + scripts/apply-snapshot.mjs.
 * Alla tal är EXAKTA (count=exact respektive fullständig histogramgenomgång),
 * aldrig PostgREST:s "estimated" — den kapar vid 1001 och ljuger däröver.
 *
 * Används av src/lib/seo.ts för att avgöra vilka hubbsidor som är tjocka nog
 * att indexeras och komma med i sitemap.
 *
 * Genererad: ${snap.generated}
 * Källa: foretag_publik filtrerad på HANTVERK_BRANSCHER (${snap.total} företag).
 */

export const SNAPSHOT_GENERERAD = "${snap.generated}";

/** Totalt antal hantverksföretag i katalogen. */
export const SNAPSHOT_TOTAL_FORETAG = ${snap.total};

/** Antal kommuner med minst ett hantverksföretag. */
export const SNAPSHOT_KOMMUNER_MED_TRAFF = ${snap.kommunerWithAny};

/** Antal hantverksföretag per kommunkod (utan ledande nolla). */
export const KOMMUN_FORETAG: Readonly<Record<string, number>> = {
${Object.entries(kommunCounts)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([code, n]) => `  "${code}": ${n},`)
  .join("\n")}
};

/** Antal hantverksföretag per kommunkod och branschid (ng1). */
export const KOMMUN_BRANSCH_FORETAG: Readonly<
  Record<string, Readonly<Record<string, number>>>
> = {
${pairLines}
};
`,
  "utf8",
);
console.log("skrev src/lib/seo-snapshot.ts");

// ---- 2. stats.ts -----------------------------------------------------------

let stats = readFileSync(src("stats.ts"), "utf8");

// Behåll de kurerade visningsnamnen — t_bransch kallar både 41200 och 43999
// "Byggmästare", vilket ger två identiska kort på /branscher.
const curatedNames = new Map();
for (const m of stats.matchAll(/\{ id: (\d+), name: "([^"]+)"/g)) {
  curatedNames.set(Number(m[1]), m[2]);
}

const topKommuner = snap.kommuner.slice(0, 25);
const kommunBlock = topKommuner
  .map((k) => {
    const entry = `  { code: "${k.code}", count: ${k.count} },`;
    return `${entry.padEnd(34)}// ${k.name}`;
  })
  .join("\n");

const topBranscher = snap.branscher.slice(0, 12);
const branschBlock = topBranscher
  .map(
    (b) =>
      `  { id: ${b.id}, name: "${curatedNames.get(b.id) ?? b.name}", count: ${b.count} },`,
  )
  .join("\n");

stats = stats.replace(
  /export const TOTAL_FORETAG = \d+;/,
  `export const TOTAL_FORETAG = ${snap.total};`,
);
stats = stats.replace(
  /export const TOTAL_KOMMUNER = \d+;/,
  `export const TOTAL_KOMMUNER = ${snap.kommunerWithAny};`,
);
stats = stats.replace(
  /const TOP_KOMMUNER_RAW: ReadonlyArray<RawKommunStat> = \[[\s\S]*?\n\];/,
  `const TOP_KOMMUNER_RAW: ReadonlyArray<RawKommunStat> = [\n${kommunBlock}\n];`,
);
stats = stats.replace(
  /const TOP_BRANSCHER_RAW: ReadonlyArray<RawBranschStat> = \[[\s\S]*?\n\];/,
  `const TOP_BRANSCHER_RAW: ReadonlyArray<RawBranschStat> = [\n${branschBlock}\n];`,
);
stats = stats.replace(
  / \* Genererad: [^\n]*/,
  ` * Genererad: ${snap.generated} med count=exact (se scripts/fetch-hantverk-stats.mjs).`,
);
writeFileSync(src("stats.ts"), stats, "utf8");
console.log("uppdaterade src/lib/stats.ts");

// ---- 3. hantverk-kategorier.ts (bara count-fälten) -------------------------

let kat = readFileSync(src("hantverk-kategorier.ts"), "utf8");
const katCounts = new Map(snap.kategorier.map((k) => [k.slug, k.count]));
let patched = 0;
kat = kat.replace(
  /(slug: "([^"]+)",[\s\S]*?)count: \d+,/g,
  (whole, head, slug) => {
    const n = katCounts.get(slug);
    if (n == null) return whole;
    patched++;
    return `${head}count: ${n},`;
  },
);
if (patched !== snap.kategorier.length) {
  console.error(
    `AVBRYTER: patchade ${patched} kategorier, förväntade ${snap.kategorier.length}.`,
  );
  process.exit(1);
}
writeFileSync(src("hantverk-kategorier.ts"), kat, "utf8");
console.log(`uppdaterade src/lib/hantverk-kategorier.ts (${patched} kategorier)`);
