/**
 * Funktionsflaggor. Läses vid bygget (NEXT_PUBLIC_), så en ändring kräver en ny
 * deploy — avsiktligt: en flagga som styr vad som publiceras ska inte kunna
 * slås på av en request.
 */

/**
 * Kortläge b: telefonnummer ur det färska registret (SCB, källa scb-afr), med
 * källa och datum. AV tills ägaren läst SCB:s villkor för publicering
 * (registreraafr.scb.se, BankID) — beslut 2026-11-23. Bara exakt "pa" slår på.
 * Nummer ur det gamla registret (aesamtable, DE.82) visas aldrig, oavsett flagga.
 */
export const VISA_REGISTERTELEFON = process.env.NEXT_PUBLIC_VISA_REGISTERTELEFON === "pa";

/**
 * Påfyllningen (del C, omgång 1): aktiva hantverksföretag ur Infofinder som
 * inte fanns i det gamla registret, i tabellen `hantverk_pafyllning`. PÅ läser
 * sajten vyn `hantverk_foretag_publik` (gamla och nya rader i en frågeväg); AV
 * läser den `foretag_publik` som förut. Bara exakt "pa" slår på.
 */
export const PAFYLLNING = process.env.NEXT_PUBLIC_PAFYLLNING === "pa";

/**
 * Får de nya radernas företagssidor indexeras? AV: alla nya sidor är
 * `noindex, follow` och utanför sitemap, oavsett grind 2 (beslut 2026-11-23,
 * tills källan för e-postadresserna är utredd och SCB:s villkor lästa).
 */
/**
 * Steg två (beslut 2026-11-24): rader ur det köpta registret visas bara om
 * arbetsstället är verksamt i SCB:s register, och då med SCB:s uppgifter.
 * Övriga ger 308 till en efterföljare på sajten eller 404. PÅ läser sajten den
 * materialiserade vyn `hantverk_foretag_steg2` (lib/sql/hantverk-steg2-004.sql)
 * och tar bort texterna om registrets ålder. Verkar bara tillsammans med
 * PAFYLLNING. Bara exakt "pa" slår på.
 */
export const STEG2 = PAFYLLNING && process.env.NEXT_PUBLIC_STEG2 === "pa";

export const INDEXERA_PAFYLLNING = process.env.NEXT_PUBLIC_INDEXERA_PAFYLLNING === "pa";

/**
 * Listornas sortering (lib/queries.ts, ordnaLista). "a" är dagens: betald
 * profil, huvudkod före bikod, antal arbetsställen. "b" provas på preview
 * (beslut 2026-11-26): betald profil, hemsida, övriga; inom varje grupp
 * huvudkod före bikod och storleksklass. Bara exakt "b" slår på, och bara
 * tillsammans med STEG2. Inte satt i produktion.
 */
export const SORTERING: "a" | "b" = STEG2 && process.env.NEXT_PUBLIC_SORTERING === "b" ? "b" : "a";
