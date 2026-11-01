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
export { REGISTER_AR };

/** Längre förklaring — används i informationsrutor och sidfot. */
export const REGISTER_FORKLARING =
  `Kontaktuppgifterna kommer från ett näringslivsregister som ` +
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
