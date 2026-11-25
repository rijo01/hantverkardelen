import { PAFYLLNING, STEG2 } from "./flaggor";
import { KOMMUN_BRANSCH_FORETAG } from "./seo-snapshot";
import { KOMMUN_BRANSCH_FORETAG_NYA } from "./seo-snapshot-pafyllning";
import { KOMMUN_BRANSCH_FORETAG_STEG2 } from "./seo-snapshot-steg2";

/**
 * Påfyllningens tillskott till sajtens förberäknade antal (yrkessidan,
 * kommunlistan, kategorierna). Noll när flaggan PAFYLLNING är av.
 * Underlaget är seo-snapshot-pafyllning.ts; rader utan kommun räknas inte.
 *
 * Med steg två (STEG2) är "tillskottet" skillnaden mellan antalen i
 * hantverk_foretag_steg2 (seo-snapshot-steg2.ts) och det köpta registrets
 * antal (seo-snapshot.ts). Den är oftast negativ: upphörda rader är borta.
 */
const perNg1 = new Map<number, number>();
const perKommun = new Map<string, number>();
const lagg = (kommun: string, ng1: string, n: number) => {
  perNg1.set(Number(ng1), (perNg1.get(Number(ng1)) ?? 0) + n);
  perKommun.set(kommun, (perKommun.get(kommun) ?? 0) + n);
};
if (STEG2) {
  for (const [kommun, branscher] of Object.entries(KOMMUN_BRANSCH_FORETAG_STEG2)) {
    for (const [ng1, n] of Object.entries(branscher)) lagg(kommun, ng1, n);
  }
  for (const [kommun, branscher] of Object.entries(KOMMUN_BRANSCH_FORETAG)) {
    for (const [ng1, n] of Object.entries(branscher)) lagg(kommun, ng1, -n);
  }
} else if (PAFYLLNING) {
  for (const [kommun, branscher] of Object.entries(KOMMUN_BRANSCH_FORETAG_NYA)) {
    for (const [ng1, n] of Object.entries(branscher)) lagg(kommun, ng1, n);
  }
}

export const nyaIBransch = (ng1: number): number => perNg1.get(ng1) ?? 0;
export const nyaIKommun = (kommun: string): number => perKommun.get(kommun) ?? 0;
