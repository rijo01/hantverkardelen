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
 * Genererad: 2026-05-26 (efter whitelist-rensning: bort 16239, 25720, 28220, 81210, 81221, 81290).
 */

/** Total ⌀ estimated count(*) från foretag_publik filtrerat på hantverks-branscher. */
export const TOTAL_FORETAG = 78613;
export const TOTAL_KOMMUNER = 290;
/** Antal branscher i Hantverkardelens whitelist (single source: hantverk-branscher.ts). */
export const TOTAL_BRANSCHER = HANTVERK_BRANSCHER.length;
export const TOTAL_LAN = 21;

type RawKommunStat = { code: string; count: number };
type RawBranschStat = { id: number; name: string; count: number };

const TOP_KOMMUNER_RAW: ReadonlyArray<RawKommunStat> = [
  { code: "180", count: 11121 },  // Stockholm
  { code: "1480", count: 4622 },  // Göteborg
  { code: "1280", count: 2573 },  // Malmö
  { code: "380", count: 1583 },   // Uppsala
  { code: "126", count: 1001 },   // Huddinge
  { code: "136", count: 1001 },   // Haninge
  { code: "188", count: 1001 },   // Norrtälje
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
  { id: 41200, name: "Byggmästare", count: 17419 },
  { id: 43210, name: "Elektriker", count: 10742 },
  { id: 43320, name: "Snickare", count: 9822 },
  { id: 43120, name: "Mark- och grundarbeten", count: 8576 },
  { id: 43341, name: "Målare", count: 6143 },
  { id: 43221, name: "VVS & Rörmokare", count: 6054 },
  { id: 43999, name: "Bygg & Anläggning", count: 5252 },
  { id: 43330, name: "Golvläggare", count: 3324 },
  { id: 43911, name: "Takläggare", count: 2374 },
  { id: 43222, name: "Ventilationsfirmor", count: 2048 },
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
