import { kommunByCode, type Kommun } from "./kommuner";
import { branschPageSlug } from "./queries";
import { HANTVERK_BRANSCHER } from "./hantverk-branscher";

/**
 * Förberäknad statistik från `foretag_publik` — Hantverkardelen-nisch.
 *
 * Statiska indexsidor (/, /kommuner, /branscher) visar dessa tal istället för
 * att räkna live. Kommun- och branschsidorna räknar däremot exakt vid render.
 *
 * Datan uppdateras med:
 *   node scripts/fetch-hantverk-stats.mjs > /tmp/hantverk-stats.json
 *   node scripts/apply-snapshot.mjs /tmp/hantverk-stats.json
 *
 * Talen nedan MÅSTE komma från count=exact. Fram till 2026-09-07 genererades
 * de med PostgREST:s count=estimated, som räknar exakt bara upp till max_rows
 * (1000) och returnerar 1001 däröver. Huddinge, Haninge, Norrtälje, Glasmästare
 * och Trädgård stod därför alla på exakt "1 001" — ett tal som inte fanns i
 * databasen. Byggspärren längst ner i filen stoppar en återgång.
 *
 * Genererad: 2026-09-07 med count=exact (se scripts/fetch-hantverk-stats.mjs).
 */

/** Exakt count(*) från foretag_publik filtrerat på hantverks-branscher. */
export const TOTAL_FORETAG = 76790;
/** Kommuner med minst ett hantverksföretag (av 290 totalt). */
export const TOTAL_KOMMUNER = 290;
/** Antal branscher i Hantverkardelens whitelist (single source: hantverk-branscher.ts). */
export const TOTAL_BRANSCHER = HANTVERK_BRANSCHER.length;
export const TOTAL_LAN = 21;

type RawKommunStat = { code: string; count: number };
type RawBranschStat = { id: number; name: string; count: number };

const TOP_KOMMUNER_RAW: ReadonlyArray<RawKommunStat> = [
  { code: "180", count: 6093 },   // Stockholm
  { code: "1480", count: 2936 },  // Göteborg
  { code: "1280", count: 1463 },  // Malmö
  { code: "380", count: 1292 },   // Uppsala
  { code: "126", count: 1271 },   // Huddinge
  { code: "136", count: 1204 },   // Haninge
  { code: "188", count: 1002 },   // Norrtälje
  { code: "1880", count: 975 },   // Örebro
  { code: "581", count: 971 },    // Norrköping
  { code: "1384", count: 894 },   // Kungsbacka
  { code: "182", count: 869 },    // Nacka
  { code: "1283", count: 852 },   // Helsingborg
  { code: "181", count: 831 },    // Södertälje
  { code: "1980", count: 822 },   // Västerås
  { code: "1490", count: 788 },   // Borås
  { code: "120", count: 786 },    // Värmdö
  { code: "127", count: 786 },    // Botkyrka
  { code: "580", count: 752 },    // Linköping
  { code: "680", count: 737 },    // Jönköping
  { code: "2480", count: 701 },   // Umeå
  { code: "484", count: 700 },    // Eskilstuna
  { code: "2281", count: 693 },   // Sundsvall
  { code: "1380", count: 651 },   // Halmstad
  { code: "2180", count: 642 },   // Gävle
  { code: "117", count: 635 },    // Österåker
];

const TOP_BRANSCHER_RAW: ReadonlyArray<RawBranschStat> = [
  { id: 41200, name: "Byggmästare", count: 15825 },
  { id: 43210, name: "Elektriker", count: 9690 },
  { id: 43320, name: "Snickare", count: 9301 },
  { id: 43120, name: "Mark- och grundarbeten", count: 8460 },
  { id: 43341, name: "Målare", count: 5784 },
  { id: 43221, name: "VVS & Rörmokare", count: 5769 },
  { id: 43999, name: "Bygg & Anläggning", count: 5096 },
  { id: 43330, name: "Golvläggare", count: 3100 },
  { id: 43911, name: "Takläggare", count: 2209 },
  { id: 43222, name: "Ventilationsfirmor", count: 1912 },
  { id: 81300, name: "Trädgård & Park", count: 1689 },
  { id: 43290, name: "Bygginstallationer", count: 1496 },
];

/**
 * BYGGSPÄRR — inget publicerat tal får vara en artefakt av radtaket.
 *
 * PostgREST kapar `count=estimated` vid max_rows och rapporterar då exakt
 * 1001. Ett snapshotvärde på 1001 betyder därför nästan alltid "minst 1001,
 * vi vet inte", inte "1001 stycken". Samma sak för 1000 från en kapad
 * `.limit()`-hämtning. Hellre ett brutet bygge än ett påhittat tal på sajten.
 *
 * Är talet äkta — regenerera med count=exact och lägg till det i
 * TILLATNA_TAKVARDEN med en kommentar om hur det verifierats.
 */
const TAKARTEFAKTER = new Set([1000, 1001]);
const TILLATNA_TAKVARDEN = new Set<number>([
  // Inga i nuläget. Kontrollerat 2026-09-07 mot count=exact.
]);

{
  const misstankta: string[] = [];
  const kolla = (label: string, n: number) => {
    if (TAKARTEFAKTER.has(n) && !TILLATNA_TAKVARDEN.has(n)) {
      misstankta.push(`${label} = ${n}`);
    }
  };
  kolla("TOTAL_FORETAG", TOTAL_FORETAG);
  for (const r of TOP_KOMMUNER_RAW) kolla(`kommun ${r.code}`, r.count);
  for (const r of TOP_BRANSCHER_RAW) kolla(`bransch ${r.id} (${r.name})`, r.count);
  if (misstankta.length > 0) {
    throw new Error(
      "Misstänkt radtaks-artefakt i src/lib/stats.ts: " +
        misstankta.join(", ") +
        ". Talet kommer sannolikt från count=estimated (kapar vid 1001) " +
        "eller en kapad .limit()-hämtning. Regenerera med " +
        "scripts/fetch-hantverk-stats.mjs (count=exact).",
    );
  }
}

export type KommunStat = {
  kommun: Kommun;
  count: number;
  href: string;
};

export type BranschStat = {
  id: number;
  name: string;
  count: number;
  /** SNI-slug — använd kombinerat med en kommun: /kommun/{slug}/{branschSlug} */
  slug: string;
};

const _TOP_KOMMUNER: KommunStat[] = TOP_KOMMUNER_RAW.map((r) => {
  const k = kommunByCode(r.code);
  if (!k) throw new Error(`Unknown kommun code in stats: ${r.code}`);
  return { kommun: k, count: r.count, href: `/kommun/${k.slug}` };
});

const _TOP_BRANSCHER: BranschStat[] = TOP_BRANSCHER_RAW.map((r) => ({
  id: r.id,
  name: r.name,
  count: r.count,
  slug: branschPageSlug(r.name, r.id),
}));

export const TOP_KOMMUNER: ReadonlyArray<KommunStat> = _TOP_KOMMUNER;
export const TOP_BRANSCHER: ReadonlyArray<BranschStat> = _TOP_BRANSCHER;

// kommunForetagCount() låg här och matade kommunsidans rubriktal ur den här
// snapshoten. Just de värdena var 1001-artefakter, och sidan räknar numera
// exakt vid render (countForetagInKommun). Behöver du ett förberäknat tal per
// kommun finns hela uppsättningen i lib/seo-snapshot.ts.
