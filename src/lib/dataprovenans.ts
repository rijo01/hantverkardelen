/**
 * Ärlig märkning av var uppgifterna kommer ifrån.
 *
 * Bakgrund: företagsuppgifterna — inte minst telefonnumren — härstammar från
 * ett näringslivsregister som samlades in omkring 2008–2011. Databasen har
 * ingen kolumn för insamlingsdatum, så vi kan inte datera enskilda rader;
 * åldern är känd på beståndsnivå, inte per post. Sajten påstod tidigare
 * "Officiell registerdata" utan årtal, vilket lät som en färsk uppgift.
 *
 * Regel: varje yta som visar registeruppgifter ska säga att de är från
 * omkring REGISTER_AR. Telefonnummer är undantaget sedan 2026-11-01: ur
 * registret visas inga (DE.82), och de som visas har företaget självt lämnat,
 * så de bär ingen åldersmärkning.
 */

/** Året registret senast kan beläggas ha uppdaterats. Delas i klustret. */
import { REGISTER_AR } from "./kluster/register";
import { PAFYLLNING, STEG2 } from "./flaggor";
export { REGISTER_AR };

/**
 * Längre förklaring — används i informationsrutor och sidfot. Med steg två
 * är bara kunderna kvar ur det köpta registret, och då nämns ingen ålder.
 */
export const REGISTER_FORKLARING = STEG2
  ? "Uppgifterna kommer från ett näringslivsregister och från företaget självt. " +
    "Telefonnummer visas bara när företaget självt har lämnat dem. " +
    "Kontrollera uppgiften innan du förlitar dig på den."
  : `Kontaktuppgifterna kommer från ett näringslivsregister som ` +
  `senast uppdaterades omkring ${REGISTER_AR}. Adresser och e-postadresser ` +
  `kan ha ändrats sedan dess, och företag kan ha upphört. Telefonnummer visas ` +
  `bara när företaget självt har lämnat dem. ` +
  `Kontrollera uppgiften innan du förlitar dig på den.`;

/**
 * Vad vi faktiskt gör med person- och organisationsnummer.
 *
 * Detta är formulerat efter vad koden gör, inte efter vad som låter bra:
 *  - Personnummer hämtas aldrig ut ur databasvyn.
 *  - Enskilda firmor får därför inget nummer visat alls.
 *  - Juridiska personers organisationsnummer visas i sin helhet — de är
 *    offentliga och omfattas inte av samma skydd.
 */
export const PERSONUPPGIFT_FORKLARING =
  "Personnummer publiceras aldrig här — för enskilda firmor visas inget " +
  "nummer alls. Organisationsnummer för aktiebolag och andra juridiska " +
  "personer är offentliga uppgifter och visas i sin helhet.";

/**
 * Källangivelsen för uppgifter ur SCB:s företagsregister, ordagrant (beslut
 * 2026-11-24). Står på varje företagssida ur påfyllningen, under varje lista
 * som innehåller sådana företag och i sidfoten när påfyllningen är på.
 */
export const SCB_KALLANGIVELSE =
  "Källa: SCB:s allmänna företagsregister. Uppgifterna är bearbetade av Hantverkardelen.";

/**
 * Källtexten för en rad med SCB:s uppgifter (påfyllningen, kalla =
 * "infofinder", och steg två, "register_scb"), med SCB:s registerdatum
 * (afr_datum). Telefonnummer ur SCB visas inte förrän SCB:s villkor är lästa
 * (lib/flaggor.ts).
 */
export function nyKallaForklaring(uppdaterad: string | null): string {
  const nar = uppdaterad ? ` Uppgifterna är från SCB:s register ${uppdaterad}.` : "";
  return (
    "Det gäller namn, adress, bransch och storlek." +
    nar +
    " Telefonnummer visas bara när företaget självt har lämnat dem. Kontrollera uppgiften innan du förlitar dig på den."
  );
}

/**
 * Källan i en mening, för sidfot, startsida och listor. Med påfyllningen
 * (flaggan PAFYLLNING) kommer en del av företagen ur SCB:s företagsregister.
 */
export const KALLA_KORT = STEG2
  ? "SCB:s företagsregister"
  : PAFYLLNING
  ? `ett register från omkring ${REGISTER_AR} och SCB:s företagsregister`
  : `ett register från omkring ${REGISTER_AR}`;

/** Sidfotens längre förklaring, med påfyllningen när flaggan är på. */
export const SIDFOT_FORKLARING = STEG2
  ? "Namn, adress, bransch och storlek kommer från SCB:s företagsregister, och datum " +
    "står på varje företags sida. Företag med en profil hos oss har själva lämnat sina " +
    "uppgifter. Telefonnummer visas bara när företaget självt har lämnat dem. " +
    "Kontrollera uppgiften innan du förlitar dig på den. " +
    SCB_KALLANGIVELSE
  : PAFYLLNING
  ? `De flesta uppgifterna kommer från ett näringslivsregister som senast ` +
    `uppdaterades omkring ${REGISTER_AR}; företag som lagts till senare kommer ` +
    `från SCB:s företagsregister, och det står på varje företags sida. Adresser ` +
    `kan ha ändrats och företag kan ha upphört. Telefonnummer visas bara när ` +
    `företaget självt har lämnat dem. Kontrollera uppgiften innan du förlitar dig på den. ` +
    SCB_KALLANGIVELSE
  : REGISTER_FORKLARING;
