import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getSupabaseAnon } from "./supabase";
import { ANTAL_TAGG } from "./antal";

/**
 * Datumen för uppgifterna ur SCB:s företagsregister, för integritetspolicyn:
 * SCB:s registerdatum och dagen då de lästes in hos oss. Läses ur
 * hantverk_scb_datum() (lib/sql/hantverk-steg2-007.sql), så att texten följer
 * den dagliga körningen utan deploy. Cachas ett dygn och rensas med antalen
 * (/api/steg2/revalidera). Svarar inte databasen blir båda null, och sidan
 * utelämnar meningen i stället för att visa ett gammalt datum.
 */
export type ScbDatum = { afr: string | null; inlast: string | null };

async function las(): Promise<ScbDatum> {
  const { data, error } = await getSupabaseAnon().rpc("hantverk_scb_datum");
  if (error || !data) throw new Error(`hantverk_scb_datum: ${error?.message ?? "inget svar"}`);
  const d = data as { afr?: string | null; inlast?: string | null };
  if (!d.afr || !d.inlast) throw new Error("hantverk_scb_datum: datum saknas");
  return { afr: d.afr, inlast: d.inlast };
}

const lasCachad = unstable_cache(las, ["hantverk-scb-datum-v1"], { revalidate: 86400, tags: [ANTAL_TAGG] });

export const hamtaScbDatum = cache(async (): Promise<ScbDatum> => {
  try {
    return await lasCachad();
  } catch (e) {
    console.error("[scb-datum] kunde inte läsas", e);
    return { afr: null, inlast: null };
  }
});

/** "2026-11-24" → "24 november 2026". */
export function svensktDatum(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
