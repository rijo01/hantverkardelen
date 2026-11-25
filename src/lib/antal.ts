import { cache } from "react";
import { unstable_cache } from "next/cache";
import { PAFYLLNING, STEG2 } from "./flaggor";
import { getSupabaseAnon } from "./supabase";
import { KOMMUN_BRANSCH_FORETAG, KOMMUN_FORETAG } from "./seo-snapshot";
import { KOMMUN_BRANSCH_FORETAG_NYA, KOMMUN_FORETAG_NYA } from "./seo-snapshot-pafyllning";
import { KOMMUN_BRANSCH_FORETAG_STEG2 } from "./seo-snapshot-steg2";

/**
 * Sajtens förberäknade antal: företag per kommun och per kommun × yrke.
 * De styr grind 1 (lib/seo.ts), sitemap, rubriktalen och yrkes- och
 * kommunlistornas tal.
 *
 * Steg två PÅ: antalen läses ur tabellen hantverk_antal, som den dagliga
 * körningen skriver (scripts/steg2-upphorda.mjs → hantverk_steg2_bygg_om()).
 * Antal och grind följer då data utan deploy. Cachas ett dygn och rensas av
 * /api/steg2/revalidera (taggen ANTAL_TAGG). Svarar inte databasen används
 * reservfilen seo-snapshot-steg2.ts.
 *
 * Steg två AV: de genererade filerna, precis som förut (seo-snapshot.ts plus
 * påfyllningens tillskott när PAFYLLNING är på).
 */

export const ANTAL_TAGG = "hantverk-antal";

type KommunBransch = Readonly<Record<string, Readonly<Record<string, number>>>>;

export type Antal = {
  /** Företag i kommunen. */
  kommun(kod: string): number;
  /** Företag i kommunen inom yrket (ng1). */
  kommunBransch(kod: string, ng1: number): number;
  /** Yrkena i kommunen: ng1 (som sträng) → antal. */
  branscherIKommun(kod: string): Readonly<Record<string, number>>;
  /**
   * Skillnaden mot det köpta registrets antal (seo-snapshot.ts). Läggs på
   * talen i stats.ts och hantverk-kategorier.ts, som utgår från registret.
   */
  nyaIKommun(kod: string): number;
  nyaIBransch(ng1: number): number;
  /** "databas", "reservfil" eller "fil". */
  kalla: string;
};

async function lasTabell(): Promise<Record<string, Record<string, number>>> {
  const supa = getSupabaseAnon();
  const ut: Record<string, Record<string, number>> = {};
  for (let off = 0; ; off += 1000) {
    const { data, error } = await supa
      .from("hantverk_antal")
      .select("kommun,ng1,n")
      .order("kommun")
      .order("ng1")
      .range(off, off + 999);
    // Kasta i stället för att returnera tomt: unstable_cache får aldrig spara
    // ett tomt svar som sedan stänger alla hubbar i ett dygn.
    if (error || !data) throw new Error(`hantverk_antal: ${error?.message ?? "inget svar"}`);
    for (const r of data as { kommun: string; ng1: number; n: number }[]) (ut[r.kommun] ??= {})[String(r.ng1)] = r.n;
    if (data.length < 1000) break;
  }
  if (Object.keys(ut).length === 0) throw new Error("hantverk_antal är tom");
  return ut;
}

const lasTabellCachad = unstable_cache(lasTabell, ["hantverk-antal-v1"], {
  revalidate: 86400,
  tags: [ANTAL_TAGG],
});

function bygg(kb: KommunBransch, kommunTotal: ((kod: string) => number) | null, kalla: string): Antal {
  const perKommun = new Map<string, number>();
  const perNg1 = new Map<number, number>();
  for (const [kod, b] of Object.entries(kb)) {
    for (const [ng1, n] of Object.entries(b)) {
      perKommun.set(kod, (perKommun.get(kod) ?? 0) + n);
      perNg1.set(Number(ng1), (perNg1.get(Number(ng1)) ?? 0) + n);
    }
  }
  const basKommun = new Map<string, number>();
  const basNg1 = new Map<number, number>();
  for (const [kod, b] of Object.entries(KOMMUN_BRANSCH_FORETAG)) {
    for (const [ng1, n] of Object.entries(b)) {
      basKommun.set(kod, (basKommun.get(kod) ?? 0) + n);
      basNg1.set(Number(ng1), (basNg1.get(Number(ng1)) ?? 0) + n);
    }
  }
  return {
    kommun: (kod) => (kommunTotal ? kommunTotal(kod) : (perKommun.get(kod) ?? 0)),
    kommunBransch: (kod, ng1) => kb[kod]?.[String(ng1)] ?? 0,
    branscherIKommun: (kod) => kb[kod] ?? {},
    nyaIKommun: (kod) => (perKommun.get(kod) ?? 0) - (basKommun.get(kod) ?? 0),
    nyaIBransch: (ng1) => (perNg1.get(ng1) ?? 0) - (basNg1.get(ng1) ?? 0),
    kalla,
  };
}

/** Antalen som gäller just nu. Ett anrop per rendering räcker (React cache). */
export const hamtaAntal = cache(async (): Promise<Antal> => {
  if (STEG2) {
    try {
      return bygg(await lasTabellCachad(), null, "databas");
    } catch (e) {
      console.error("[antal] hantverk_antal kunde inte läsas, använder reservfilen", e);
      return bygg(KOMMUN_BRANSCH_FORETAG_STEG2, null, "reservfil");
    }
  }
  if (!PAFYLLNING) {
    return bygg(KOMMUN_BRANSCH_FORETAG, (kod) => KOMMUN_FORETAG[kod] ?? 0, "fil");
  }
  // Påfyllningen utan steg två: registret plus tillskottet, som förut.
  const kb: Record<string, Record<string, number>> = {};
  for (const kalla of [KOMMUN_BRANSCH_FORETAG, KOMMUN_BRANSCH_FORETAG_NYA]) {
    for (const [kod, b] of Object.entries(kalla)) {
      for (const [ng1, n] of Object.entries(b)) (kb[kod] ??= {})[ng1] = (kb[kod][ng1] ?? 0) + n;
    }
  }
  return bygg(kb, (kod) => (KOMMUN_FORETAG[kod] ?? 0) + (KOMMUN_FORETAG_NYA[kod] ?? 0), "fil");
});
