import { PAFYLLNING } from "./flaggor";
import { KOMMUN_BRANSCH_FORETAG_NYA } from "./seo-snapshot-pafyllning";

/**
 * Påfyllningens tillskott till sajtens förberäknade antal (yrkessidan,
 * kommunlistan, kategorierna). Noll när flaggan PAFYLLNING är av.
 * Underlaget är seo-snapshot-pafyllning.ts; rader utan kommun räknas inte.
 */
const perNg1 = new Map<number, number>();
const perKommun = new Map<string, number>();
if (PAFYLLNING) {
  for (const [kommun, branscher] of Object.entries(KOMMUN_BRANSCH_FORETAG_NYA)) {
    for (const [ng1, n] of Object.entries(branscher)) {
      perNg1.set(Number(ng1), (perNg1.get(Number(ng1)) ?? 0) + n);
      perKommun.set(kommun, (perKommun.get(kommun) ?? 0) + n);
    }
  }
}

export const nyaIBransch = (ng1: number): number => perNg1.get(ng1) ?? 0;
export const nyaIKommun = (kommun: string): number => perKommun.get(kommun) ?? 0;
