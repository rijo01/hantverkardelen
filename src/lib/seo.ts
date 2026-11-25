import type { Metadata } from "next";
import type { Foretag } from "./queries";
import { INDEXERA_PAFYLLNING } from "./flaggor";
import { hamtaAntal } from "./antal";

/**
 * Tvågrindsmodellen — vilka sidor får indexeras.
 *
 * Bakgrund: Search Console avvisade 2 098 sidor. Katalogen har 76 790
 * företagssidor och 5 709 kommun×bransch-sidor, men det mesta av innehållet
 * är en rad ur ett register: namn, adress och ett telefonnummer från omkring
 * 2011. Sidor som bara omvandlar en databasrad till HTML utan att tillföra
 * något är precis vad Google räknar som doorway/thin content.
 *
 * Därför två grindar, båda med samma princip: en sida får bara indexeras om
 * den har något att visa.
 *
 *   Grind 1 — hubbar (/kommun/x, /kommun/x/bransch)
 *     Minst MIN_HUB_FORETAG faktiskt renderade företag. En branschsida med
 *     två träffar är inte en katalogsida, den är en återvändsgränd.
 *
 *   Grind 2 — företagssidor (/foretag/x)
 *     Företaget måste ha något utöver den nakna registerraden: en
 *     beskrivning, en webbplats, en e-postadress eller status som betalkund.
 *     Enbart namn + adress + gammalt telefonnummer räcker inte.
 *     Påfyllningens verksamhetsbeskrivning (Bolagsverket) räknas inte: den är
 *     bolagsordningens standardtext och finns på nästan varje rad.
 *
 * Allt som inte passerar får `noindex, follow` och hålls utanför sitemap.
 * `follow` behålls så att Google fortsätter gå vidare till de sidor som
 * faktiskt håller — vi vill gömma tunna sidor, inte kapa länkgrafen.
 *
 * Sitemap och robots-taggar MÅSTE härledas ur samma funktioner här.
 * src/app/sitemap.ts kastar om en URL den är på väg att publicera inte
 * passerar sin grind.
 */

/** Minsta antal renderade företag för att en hubbsida ska indexeras. */
export const MIN_HUB_FORETAG = 5;

export const ROBOTS_INDEX: Metadata["robots"] = { index: true, follow: true };
export const ROBOTS_NOINDEX: Metadata["robots"] = { index: false, follow: true };

export function robotsFor(indexable: boolean): Metadata["robots"] {
  return indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX;
}

// ---- Grind 1: hubbar -------------------------------------------------------

/**
 * Antal hantverksföretag i en kommun. Underlaget är lib/antal.ts: tabellen
 * hantverk_antal när steg två är på, annars de genererade filerna. Behövs
 * många tal på en sida, hämta `hamtaAntal()` en gång och fråga den.
 */
export async function snapshotKommunCount(kommunCode: string): Promise<number> {
  return (await hamtaAntal()).kommun(kommunCode);
}

/** Antal hantverksföretag i en kommun + bransch (se snapshotKommunCount). */
export async function snapshotKommunBranschCount(kommunCode: string, ng1: number): Promise<number> {
  return (await hamtaAntal()).kommunBransch(kommunCode, ng1);
}

/** Passerar en hubbsida med `count` renderbara företag grinden? */
export function hubIsIndexable(count: number): boolean {
  return count >= MIN_HUB_FORETAG;
}

// ---- Grind 2: företagssidor ------------------------------------------------

function harText(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Har företagssidan substans utöver den nakna registerraden?
 *
 * Medvetet utanför listan: `aeant` (antal anställda) och `tel`. Båda finns på
 * nästan varje rad — 68 477 av företagen har ett telefonnummer — så de
 * särskiljer ingenting och gör inte sidan värd att indexera.
 */
export function foretagHarSubstans(
  f: Pick<Foretag, "infotext" | "webb" | "epostadress" | "poang">,
): boolean {
  return (
    harText(f.infotext) ||
    harText(f.webb) ||
    harText(f.epostadress) ||
    (f.poang ?? 0) > 0
  );
}

/**
 * Får företagssidan indexeras? Kräver substans OCH ett namn att visa —
 * en sida utan rubrik är inget sökresultat värt att erbjuda.
 */
export function foretagIsIndexable(
  f: Pick<Foretag, "infotext" | "webb" | "epostadress" | "poang" | "firma" | "namn"> &
    Partial<Pick<Foretag, "kalla" | "kommun">>,
): boolean {
  if (!harText(f.firma) && !harText(f.namn)) return false;
  // Påfyllningen: alla nya sidor är noindex tills ägaren slår på indexeringen
  // (flaggor.ts). En rad utan kommun indexeras aldrig — den hör inte till
  // någon kommunsida och sökmotorn har ingen ort att visa.
  if (f.kalla === "infofinder" && (!INDEXERA_PAFYLLNING || !harText(f.kommun))) return false;
  return foretagHarSubstans(f);
}

// ---- Sökvägar som aldrig hör hemma i sitemap -------------------------------

/**
 * /sok är noindex per design (parametriserade sökresultat), så den får aldrig
 * dyka upp i sitemap oavsett vad som råkar generera URL:en.
 */
const ALDRIG_I_SITEMAP = ["/sok"];

export function farFinnasISitemap(path: string): boolean {
  return !ALDRIG_I_SITEMAP.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}
