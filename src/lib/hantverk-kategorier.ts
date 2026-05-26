/**
 * Hantverkardelens kategorier för startsidan.
 *
 * Mappning av en användarvänlig kategori-bucket till en eller flera
 * SCB-branschid (ng1). Counts är förberäknade mot foretag_publik
 * (samma datum som stats.ts).
 *
 * Designprincip — visa BARA kategorier vi kan fylla med riktig data:
 *  - Slå ihop/dölj buckets med <20 företag.
 *  - Ingen överlapp mellan buckets — varje ng1 ligger bara i en kategori.
 *  - Alla branschid kommer från HANTVERK_BRANSCHER så filter-guards passar.
 *
 * Klick på ett kategorikort skickar till /sok?kategori=<slug>.
 * /sok-route:n läser kategorin här och passerar ng1List vidare till
 * searchForetag — så att resultat-listan visar äkta träffar inom bucketen.
 *
 * Counts uppdateras via scripts/fetch-hantverk-stats.mjs.
 */

import type { LucideIcon } from "lucide-react";
import {
  Hammer,
  Zap,
  Wrench,
  Paintbrush,
  Home,
  Mountain,
  HardHat,
  Construction,
  Trees,
  Layers,
  Square,
} from "lucide-react";

export type HantverkKategori = {
  slug: string;
  name: string;
  description: string;
  ng1: readonly number[];
  count: number;
  icon: LucideIcon;
};

export const HANTVERK_KATEGORIER: ReadonlyArray<HantverkKategori> = [
  {
    slug: "bygg",
    name: "Byggföretag",
    description: "Byggmästare, byggentreprenörer, husbyggare",
    ng1: [41200, 43999, 16231],
    count: 23032,
    icon: HardHat,
  },
  {
    slug: "mark-anlaggning",
    name: "Mark & anläggning",
    description: "Grundarbete, vägbygge, rivning, infrastruktur",
    ng1: [43120, 43110, 42110, 42120, 42210, 42220, 42910, 42990],
    count: 11103,
    icon: Mountain,
  },
  {
    slug: "el",
    name: "El & installation",
    description: "Elektriker, elinstallation, kraftöverföring",
    ng1: [43210],
    count: 10742,
    icon: Zap,
  },
  {
    slug: "snickeri",
    name: "Snickeri & kök",
    description: "Snickare, köksinredning, dörrar & fönster",
    ng1: [43320, 16233, 25120],
    count: 10544,
    icon: Hammer,
  },
  {
    slug: "vvs",
    name: "VVS, rör & ventilation",
    description: "VVS, rörarbeten, ventilation, kyla & värme",
    ng1: [43221, 43222, 43223, 43290],
    count: 8823,
    icon: Wrench,
  },
  {
    slug: "maleri",
    name: "Måleri",
    description: "Måleriarbeten — invändigt och utvändigt",
    ng1: [43341],
    count: 6143,
    icon: Paintbrush,
  },
  {
    slug: "golv",
    name: "Golv",
    description: "Golvläggning, parkett, klinker, mattor",
    ng1: [43330],
    count: 3324,
    icon: Square,
  },
  {
    slug: "tak",
    name: "Tak",
    description: "Takläggare, plåttak, papp- och tegeltak",
    ng1: [43911, 43912],
    count: 2735,
    icon: Home,
  },
  {
    slug: "glas",
    name: "Glas",
    description: "Glasmästeri, fönsterglas, isolerglas",
    ng1: [43342],
    count: 1001,
    icon: Square,
  },
  {
    slug: "tradgard",
    name: "Trädgård",
    description: "Skötsel av grönytor, trädgårdsarbete",
    ng1: [81300],
    count: 1001,
    icon: Trees,
  },
  {
    slug: "betong",
    name: "Betong & material",
    description: "Fabriksbetong, betongvaror, prefab",
    ng1: [23630, 23610, 23690],
    count: 465,
    icon: Construction,
  },
  {
    slug: "puts-fasad",
    name: "Puts & fasad",
    description: "Putsning, fasadbeklädnad, stuckatörsarbeten",
    ng1: [43310],
    count: 422,
    icon: Layers,
  },
];

/** Slå upp en kategori via slug. */
export function getKategoriBySlug(slug: string): HantverkKategori | null {
  return HANTVERK_KATEGORIER.find((k) => k.slug === slug) ?? null;
}
