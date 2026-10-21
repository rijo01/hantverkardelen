/**
 * Visningsnamn per bransch (ng1) — bara presentation.
 *
 * t_bransch ger flera koder samma beskrivning: 41200, 43999 och 16231 heter
 * alla "Byggmästare" där, och 43911/43912 heter båda "Takarbeten". På en
 * kommunsida blev det tre likadana rader som ledde till tre olika listor.
 * Här får varje kod ett eget namn som säger vad som skiljer den från de andra.
 *
 * Påverkar INTE vilka branscher som ingår (det är hantverk-branscher.ts), inte
 * sidornas rubriker eller metadata (de läser t_bransch som förut) och inte
 * URL:erna. Saknas en kod här faller anroparen tillbaka på registrets namn.
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
  16233: "Kök- & badrumsinredning",
  25120: "Dörrar & fönster",
  81300: "Trädgård & grönytor",
  23630: "Fabriksbetong",
  23610: "Betongvaror",
  23690: "Övriga betongvaror",
};

export function yrkesnamn(ng1: number, registerNamn?: string | null): string {
  return YRKESNAMN[ng1] ?? registerNamn ?? `Bransch ${ng1}`;
}
