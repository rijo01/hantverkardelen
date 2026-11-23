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
