import { kommunByCode, type Kommun } from "./kommuner";
import { branschPageSlug } from "./queries";
import { HANTVERK_BRANSCHER } from "./hantverk-branscher";

/**
 * Förberäknad statistik från `foretag_publik` — Hantverkardelen-nisch.
 *
 * Counts mot vyn timeoutar för storstäder via anon-nyckeln, så vi snapshotar
 * tunga aggregat här istället för att räkna live på varje sidvisning.
 *
 * Datan uppdateras manuellt:
 *   node scripts/fetch-hantverk-stats.mjs > /tmp/hantverk-stats.json
 * Klistra därefter in nya värden i listorna nedan.
 *
 * Genererad: 2026-05-24
 */

/** Total ⌀ estimated count(*) från foretag_publik filtrerat på hantverks-branscher. */
export const TOTAL_FORETAG = 79534;
export const TOTAL_KOMMUNER = 290;
/** Antal branscher i Hantverkardelens whitelist (single source: hantverk-branscher.ts). */
export const TOTAL_BRANSCHER = HANTVERK_BRANSCHER.length;
export const TOTAL_LAN = 21;

type RawKommunStat = { code: string; count: number };
type RawBranschStat = { id: number; name: string; count: number };

const TOP_KOMMUNER_RAW: ReadonlyArray<RawKommunStat> = [
  { code: "180", count: 10848 },  // Stockholm
  { code: "1480", count: 4677 },  // Göteborg
  { code: "1280", count: 2558 },  // Malmö
  { code: "380", count: 1498 },   // Uppsala
  { code: "1880", count: 1076 },  // Örebro
  { code: "126", count: 1001 },   // Huddinge
  { code: "136", count: 1001 },   // Haninge
  { code: "182", count: 1001 },   // Nacka
  { code: "188", count: 1001 },   // Norrtälje
  { code: "581", count: 1001 },   // Norrköping
  { code: "127", count: 992 },    // Botkyrka
  { code: "1283", count: 982 },   // Helsingborg
  { code: "1384", count: 969 },   // Kungsbacka
  { code: "181", count: 933 },    // Södertälje
  { code: "1980", count: 909 },   // Västerås
  { code: "1490", count: 875 },   // Borås
  { code: "120", count: 863 },    // Värmdö
  { code: "580", count: 831 },    // Linköping
  { code: "680", count: 828 },    // Jönköping
  { code: "2480", count: 791 },   // Umeå
  { code: "484", count: 781 },    // Eskilstuna
  { code: "2281", count: 758 },   // Sundsvall
  { code: "1380", count: 722 },   // Halmstad
  { code: "117", count: 695 },    // Österåker
  { code: "2180", count: 693 },   // Gävle
];

const TOP_BRANSCHER_RAW: ReadonlyArray<RawBranschStat> = [
  { id: 41200, name: "Byggmästare", count: 14610 },
  { id: 43210, name: "Elektriker", count: 10013 },
  { id: 43320, name: "Snickare", count: 8631 },
  { id: 43120, name: "Mark- och grundarbeten", count: 8349 },
  { id: 43341, name: "Målare", count: 6262 },
  { id: 43221, name: "VVS & Rörmokare", count: 6064 },
  { id: 81210, name: "Städ & Rengöring", count: 5782 },
  { id: 43999, name: "Bygg & Anläggning", count: 5585 },
  { id: 43330, name: "Golvläggare", count: 3272 },
  { id: 43911, name: "Takläggare", count: 2369 },
  { id: 43342, name: "Glasmästare", count: 1001 },
  { id: 81300, name: "Trädgård & Park", count: 1001 },
];

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

/** Statistik för en kommun om vi har snapshot — annars undefined. */
const _BY_CODE = new Map(TOP_KOMMUNER_RAW.map((r) => [r.code, r.count]));
export function kommunForetagCount(code: string): number | undefined {
  return _BY_CODE.get(code);
}
