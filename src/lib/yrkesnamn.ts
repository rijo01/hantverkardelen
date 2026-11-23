/**
 * Visningsnamn per bransch (ng1) — bara presentation.
 *
 * t_bransch ger flera koder samma beskrivning: 41200, 43999 och 16231 heter
 * alla "Byggmästare" där, och 43911/43912 heter båda "Takarbeten". På en
 * kommunsida blev det tre likadana rader som ledde till tre olika listor.
 * Här får varje kod ett eget namn som säger vad som skiljer den från de andra.
 *
 * Påverkar INTE vilka branscher som ingår (det är hantverk-branscher.ts) och
 * inte URL:erna (de byggs av registrets namn, t_bransch + kluster/klassning).
 * Rubrikerna tar registrets namn, utom där två koder delar det: se rubrikNamn.
 * Saknas en kod här faller anroparen tillbaka på registrets namn.
 */
const YRKESNAMN: Readonly<Record<number, string>> = {
  41200: "Byggföretag",
  43999: "Övrig bygg & anläggning",
  16231: "Monteringsfärdiga trähus",
  43210: "Elektriker",
  43120: "Mark- och grundarbeten",
  43110: "Rivning",
  42110: "Vägbyggen",
  42120: "Järnvägsbyggen",
  42210: "Vatten & avlopp (VA)",
  42220: "El- och teleledningar",
  42910: "Vattenbyggnad",
  42990: "Övriga anläggningsarbeten",
  43221: "VVS & rörmokare",
  43222: "Ventilation",
  43223: "Kyla & värme",
  43290: "Övriga bygginstallationer",
  43341: "Målare",
  43330: "Golv & kakel",
  43911: "Plåttak",
  43912: "Övriga takarbeten",
  43342: "Glasmästare",
  43310: "Puts & fasad",
  43320: "Snickare",
  // SNI 2007 16233 = fönster av trä, 16232 = dörrar av trä. SNI 2025 slår ihop
  // dem till 16250, som påfyllningen lägger här, och vyn hantverk_foretag_publik
  // visar de gamla 16232-raderna som 16233. Det gamla namnet "Kök- &
  // badrumsinredning" var fel. Beslut 2026-11-23.
  16233: "Dörrar & fönster av trä",
  25120: "Dörrar & fönster av metall",
  81300: "Trädgård & grönytor",
  23630: "Fabriksbetong",
  23610: "Betongvaror",
  23690: "Övriga betongvaror",
};

export function yrkesnamn(ng1: number, registerNamn?: string | null): string {
  return YRKESNAMN[ng1] ?? registerNamn ?? `Bransch ${ng1}`;
}

/**
 * Nischkoder vars registernamn (t_bransch, efter rättelserna i
 * kluster/klassning BRANSCHNAMN) delas med en annan nischkod. Kontrollerat
 * 2026-11-23:
 *   "Anläggningsarbeten"                 42110, 42120
 *   "Betong- & Betongvarutillverkning"   23610, 23630, 23690
 *   "Dörrar & Fönster"                   16233, 25120
 *   "Takarbeten"                         43911, 43912
 * Utan undantaget fick två kommun×yrke-sidor samma H1, title och brödsmula.
 */
const DELAT_REGISTERNAMN: ReadonlySet<number> = new Set([
  42110, 42120, 23610, 23630, 23690, 16233, 25120, 43911, 43912,
]);

/**
 * Namnet i rubrik, title, metabeskrivning och brödsmula för en kommun×yrke-sida
 * och länken dit. Registrets namn, utom för koder som delar det med en annan
 * kod: där yrkesnamnet ("Dörrar & fönster av trä"). Adressen byggs fortfarande
 * av registrets namn (branschPageSlug) och ändras inte.
 */
export function rubrikNamn(ng1: number, registerNamn?: string | null): string {
  if (DELAT_REGISTERNAMN.has(ng1)) return yrkesnamn(ng1, registerNamn);
  return registerNamn ?? `SNI ${ng1}`;
}
