/**
 * Klassningsrättelser — mappningstabellen för fel i registrets bransch.
 *
 * Registret (`aesamtable`, `t_bransch`) rörs aldrig. Felen rättas här, vid
 * visning, så att en återimport inte kan få tillbaka dem och så att varje
 * rättelse står på ett ställe med sitt skäl.
 *
 * Tre slag av fel:
 *
 *  1. Fel NAMN på en branschkod i t_bransch. Rättas i BRANSCHNAMN nedan, som
 *     sajtens branscher.ts läser före t_bransch. Namnet styr rubrik, brödsmula och
 *     slug, så gamla adresser (/kommun/x/byggmastare-16231) 308:as av sidans
 *     kanoniska omdirigering till den nya.
 *
 *  2. Fel YRKE på ett enskilt företag inom en kod som samlar flera yrken.
 *     SNI 43290 "Annan bygginstallation" rymmer i registret låssmeder,
 *     säkerhetsfirmor, hissfirmor och isolerare. Företaget visas med sitt
 *     verkliga yrke (yrkeFor nedan) men ligger kvar i listan — bland dem finns
 *     betalande kunder, och att flytta dem ur listan hade tagit deras placering.
 *
 *  3. Organisationer som inte hör hemma i en företagskatalog (kommuner,
 *     Vägverket m.fl.). Rättas i varje sajts fråga: NISCH_JURFORM_VILLKOR.
 *
 * Filen är identisk på alla klustrets sajter (se README.md i katalogen). En
 * kod som en sajt inte visar påverkar den sajten inte.
 */

/**
 * Rättade branschnamn. Bara koder där t_bransch säger något som är fel —
 * inte där namnet bara är kort.
 */
export const BRANSCHNAMN: Readonly<Record<number, { namn: string; skal: string }>> = {
  16231: {
    namn: "Monteringsfärdiga trähus",
    skal: "SNI 16231 är tillverkning av monteringsfärdiga trähus. t_bransch kallar den Byggmästare.",
  },
  43110: {
    namn: "Rivning",
    skal: "SNI 43110 är rivning av hus och byggnader. t_bransch kallar den Entreprenad.",
  },
  42220: {
    namn: "El- och teleledningar",
    skal: "SNI 42220 är anläggning av el- och teleledningar. t_bransch kallar den Anläggningsarbeten.",
  },
  43999: {
    namn: "Övrig bygg & anläggning",
    skal: "SNI 43999 är diverse övriga specialiserade bygg- och anläggningsarbeten. t_bransch kallar den Byggmästare, samma namn som 41200.",
  },
};

export function rattatBranschnamn(ng1: number): string | null {
  return BRANSCHNAMN[ng1]?.namn ?? null;
}

/**
 * Sökordens synonymer per branschkod — vad besökaren skriver för det registret
 * kallar koden. "rörmokare" är 43221 VVS-arbeten, inte hela VVS-kategorin med
 * låssmeder och hissfirmor från 43290.
 *
 * Bara ord som betyder just den koden hör hemma här, i gemener. Ett ord som
 * spänner över flera koder ("bygg", "tak") är en kategori och ligger i sajtens
 * egen söktolkning. Samma tabell som namnrättelserna ovan, så att namn och
 * sökord för en kod står på ett ställe. En kod som en sajt inte visar
 * påverkar den sajten inte.
 */
export const SOKORD: Readonly<Record<number, readonly string[]>> = {
  43210: [
    "elektriker", "elektrikern", "elektrikerna", "elfirma", "elfirmor", "elinstallatör",
    "elinstallatörer", "elinstallation", "elinstallationer", "laddbox", "laddboxar",
    "laddstolpe", "laddstolpar", "elcentral", "elbesiktning",
  ],
  43221: [
    "rörmokare", "rörmokaren", "rörmokarna", "rörmokeri", "rörläggare", "rörläggeri",
    "rörfirma", "rör", "avlopp", "vattenläcka", "vvsare",
  ],
  43222: ["ventilation", "ventilationsfirma", "ventilationsfirmor", "ovk", "imkanal"],
  43223: ["värmepump", "värmepumpar", "luftvärmepump", "bergvärme", "kylfirma", "kyltekniker"],
  43341: ["målare", "målaren", "måleri", "målerifirma", "målning", "tapetsering", "tapetserare"],
  43320: ["snickare", "snickaren", "snickeri", "byggnadssnickare", "köksmontering", "altan", "altanbygge"],
  43330: ["golvläggare", "golvläggning", "parkett", "kakel", "klinker", "plattsättare", "kakelsättare"],
  43342: ["glasmästare", "glasmästeri", "fönsterbyte"],
  43911: ["plåtslagare", "plåtslageri", "plåttak"],
  43310: ["putsning", "puts", "fasadputs", "stuckatör"],
  43110: ["rivning", "rivningsfirma"],
  81300: ["trädgårdsmästare", "trädgårdsskötsel", "gräsklippning", "häckklippning"],
};

const SOKORD_KOD: ReadonlyMap<string, number> = new Map(
  Object.entries(SOKORD).flatMap(([kod, ord]) => ord.map((o) => [o, Number(kod)] as const)),
);

/** Branschkoden ett sökord betyder, eller null. Ordet i gemener. */
export function kodForSokord(ord: string): number | null {
  return SOKORD_KOD.get(ord) ?? null;
}

/** Alla synonymord, för stavningsförslag. */
export function allaSokord(): string[] {
  return [...SOKORD_KOD.keys()];
}

/**
 * Yrke per företag inom koder som samlar flera yrken. Regeln läser
 * företagsnamnet; första träff vinner.
 */
const YRKE_I_KOD: Readonly<Record<number, ReadonlyArray<{ monster: RegExp; yrke: string }>>> = {
  43290: [
    { monster: /(HISS|ELEVATOR|\bLIFT|RULLTRAPP|\bKONE\b|SCHINDLER|\bOTIS\b)/i, yrke: "Hissar" },
    { monster: /(LÅS|\bLOCK|NYCKEL|SÄKERHET|SECURITY|\bLARM|ASSA\b)/i, yrke: "Lås & säkerhet" },
    { monster: /(ISOLER|AKUSTIK|LJUDDÄMP|LJUDISOL)/i, yrke: "Isolering & akustik" },
  ],
};

/** Företagets verkliga yrke när koden samlar flera, annars null. */
export function yrkeFor(f: { ng1: number | null; firma: string | null; namn: string | null }): string | null {
  if (f.ng1 == null) return null;
  const regler = YRKE_I_KOD[f.ng1];
  if (!regler) return null;
  const namn = `${f.firma ?? ""} ${f.namn ?? ""}`;
  return regler.find((r) => r.monster.test(namn))?.yrke ?? null;
}
