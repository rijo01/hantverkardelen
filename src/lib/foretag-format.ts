import type { Foretag } from "./queries";
import { jurformLabel } from "./jurform";

/**
 * Föredragna juridisk form-namn — använd jurform-koden från databasen om den
 * finns, fallback på heuristisk namn-tolkning (för rader där jurform saknas).
 */
export function legalFormFor(
  f: Pick<Foretag, "jurform" | "firma" | "namn">,
): string | null {
  const fromJurform = jurformLabel(f.jurform);
  if (fromJurform) return fromJurform;
  return detectLegalForm(f.firma || f.namn);
}

/**
 * Härled juridisk form från företagets namn-suffix. Bara fallback för
 * rader där jurform är null. Föredra `legalFormFor(f)` istället.
 */
export function detectLegalForm(rawName: string | null | undefined): string | null {
  if (!rawName) return null;
  const name = rawName.trim().toUpperCase();
  if (!name) return null;

  if (/\bBOSTADSR(Ä|A)TTSF(Ö|O)RENING(EN)?\b/.test(name) || /^BRF\b/.test(name)) {
    return "Bostadsrättsförening";
  }
  if (/\bSTIFTELSE\b/.test(name)) return "Stiftelse";
  if (/\bSAMF(Ä|A)LLIGHET(SF(Ö|O)RENING)?\b/.test(name)) return "Samfällighet";
  if (/\bEKONOMISK\s+F(Ö|O)RENING\b/.test(name) || /\bEK\.?\s*F(Ö|O)R\.?\b/.test(name)) {
    return "Ekonomisk förening";
  }
  if (/\bIDEELL\s+F(Ö|O)RENING\b/.test(name)) return "Ideell förening";
  if (/\bAB\b/.test(name)) return "Aktiebolag";
  if (/\bHB\b/.test(name)) return "Handelsbolag";
  if (/\bKB\b/.test(name)) return "Kommanditbolag";
  if (/\bF(Ö|O)RENING(EN)?\b/.test(name)) return "Förening";
  if (/\bKOMMUN(EN)?\b/.test(name) || /KOMMUN$/.test(name)) return "Kommunal verksamhet";
  if (/\bMENIGHET\b/.test(name) || /\bF(Ö|O)RSAMLING\b/.test(name)) return "Församling";
  return null;
}

// employerSize() är borta: den visade `aeant` — antal arbetsställen — som
// antal anställda. Använd anstallda() i lib/storleksklass.ts.

/** Initial-bokstav för monogram. */
export function initialFor(rawName: string | null | undefined): string {
  if (!rawName) return "·";
  const stripped = rawName
    .trim()
    .replace(/^(AKTIEBOLAGET|BOSTADSRÄTTSFÖRENINGEN|BRF)\s+/i, "");
  const first = stripped.charAt(0).toUpperCase();
  return first || "·";
}

/** Stabil gradient-färg per företag baserat på cfarnr (deterministisk). */
export function monogramGradient(cfarnr: number): string {
  // 4 fördefinierade gradienter i samma värmeskala — alla matchar brand
  const palettes = [
    "linear-gradient(135deg, #FFE48A 0%, #F7941E 65%, #8b4b06 100%)",
    "linear-gradient(135deg, #FFD000 0%, #F7941E 100%)",
    "linear-gradient(135deg, #FFB347 0%, #B86A0F 100%)",
    "linear-gradient(135deg, #FFC857 0%, #C76E2A 100%)",
  ];
  return palettes[cfarnr % palettes.length] ?? palettes[0];
}

/** Visningsnamn — föredra firma, annars namn, annars fallback. */
export function displayName(f: Pick<Foretag, "firma" | "namn">): string {
  return f.firma || f.namn || "Okänt företag";
}

/** Bygg Google Maps-URL för en adress (öppnar i ny flik). */
export function googleMapsUrl(parts: {
  gatuadress?: string | null;
  postnr?: number | null;
  postort?: string | null;
}): string | null {
  const segments = [
    parts.gatuadress,
    [parts.postnr, parts.postort].filter(Boolean).join(" "),
    "Sverige",
  ].filter(Boolean);
  if (segments.length < 2) return null;
  const q = encodeURIComponent(segments.join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Slå in webb-URL till protokoll om saknas. */
export function normalizeWebb(webb: string | null | undefined): string | null {
  if (!webb) return null;
  const w = webb.trim();
  if (!w) return null;
  if (/^https?:\/\//i.test(w)) return w;
  return `https://${w}`;
}

/** Visningsbar webb (utan protokoll, max 40 tecken). */
export function shortWebb(webb: string | null | undefined): string | null {
  if (!webb) return null;
  const w = webb.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return w.length > 40 ? `${w.slice(0, 38)}…` : w;
}

/**
 * Hur orgnr ska visas för ett företag:
 *   - Enskild firma → bara "Enskild firma". Orgnr är ett personnummer, och
 *     ingen del av det visas, inte heller en maskerad sifferrad som
 *     "19XXXXXX-XXXX" (beslut 2026-11-26; ersätter kontrakt 1.3:s form här).
 *   - Övriga med orgnr → orgnr rakt av (redan formaterat med bindestreck från vyn)
 *   - Saknas orgnr utan att vara enskild firma → null (visa inget)
 */
export function orgnrDisplay(
  f: Pick<Foretag, "orgnr" | "arEnskildFirma">,
): { kind: "orgnr"; value: string } | { kind: "hidden"; value: string } | null {
  if (f.arEnskildFirma) return { kind: "hidden", value: "Enskild firma" };
  if (f.orgnr && f.orgnr.trim()) {
    return { kind: "orgnr", value: f.orgnr.trim() };
  }
  return null;
}

/**
 * Märkningen en rad eller en profil får — och bara den här funktionen avgör den.
 * Hantverkardelen visar ingen etikett för någon av dem (beslut 2026-11-23, andra
 * gången): kunden får logotyp och fylligare profil men ingen märkning.
 *
 *   "betald"   — overlay-raden har `featured`, alltså ett aktuellt CRM-köp av
 *                framhävning. Orange ram på kortet.
 *   "komplett" — registrets `poang > 0`. Sorteras först, logotyp och
 *                sökord visas, ingen etikett.
 *
 * Tidigare hette detta isFeatured() och gav "Utvald" för båda fallen.
 * Sorteringen påverkas INTE: poang och overlay-vikten styr ordningen som förut
 * (queries.ts och overlay-rankning.ts).
 */
export type ProfilMarkning = "betald" | "komplett" | null;

export function profilMarkning(
  f: Pick<Foretag, "poang">,
  overlay?: { featured?: boolean | null } | null,
): ProfilMarkning {
  if (overlay?.featured) return "betald";
  if ((f.poang ?? 0) > 0) return "komplett";
  return null;
}
