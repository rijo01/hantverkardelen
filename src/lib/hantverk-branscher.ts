/**
 * Hantverkardelen — nischfilter.
 *
 * Whitelist över SCB-branschid (ng1) som räknas som "hem & hantverk" på
 * denna sajt. Alla företagsqueries i src/lib/queries.ts och route-handlers
 * MÅSTE filtrera mot denna lista så att vi aldrig läcker vård-, restaurang-
 * eller annan brus-bransch in i Hantverkardelens katalog.
 *
 * Källa: kuraterad av Rickard 2026-05-24 (initial scope för hantverkardelen.se).
 * Justering: lägg till/ta bort branschid här — ingen annan plats behöver
 * röras, eftersom alla call-sites importerar HANTVERK_BRANSCHER och
 * HANTVERK_BRANSCHER_SET härifrån.
 */

export const HANTVERK_BRANSCHER: readonly number[] = [
  // — Byggentreprenad —
  41200, // Byggmästare / byggnadsentreprenörer
  43999, // Övrig specialiserad bygg- och anläggningsverksamhet
  16231, // Tillverkning av monteringsfärdiga trähus
  // — El —
  43210, // Elinstallationer / elektriker
  // — Mark, anläggning, rivning —
  43120, // Mark- och grundarbeten
  43110, // Rivning av hus och byggnader
  42110, // Anläggning av vägar och motorvägar
  42120, // Anläggning av järnvägar och tunnelbanor
  42210, // Anläggning av allmännyttiga anläggningar (vatten/avlopp)
  42220, // Anläggning av kommunikationsledningar för el och telekommunikation
  42910, // Anläggning av vattenprojekt
  42990, // Anläggning av andra anläggningsprojekt
  // — VVS, ventilation, kyla —
  43221, // VVS-arbeten
  43222, // Ventilationsarbeten
  43223, // Kyl- och värmeinstallationer
  43290, // Annan bygginstallation
  // — Måleri & golv —
  43341, // Måleriarbeten
  43330, // Golv- och väggbeläggningsarbeten
  // — Tak, glas, puts/fasad —
  43911, // Takarbeten av plåt
  43912, // Andra takarbeten
  43342, // Glasmästeriarbeten
  43310, // Putsning, fasadbeklädnad och stuckatörsarbeten
  // — Snickeri, kök, inredning, dörrar/fönster —
  43320, // Byggnadssnickeriarbeten (snickeri på plats)
  16239, // Tillverkning av andra byggnads- och inredningssnickerier
  16233, // Tillverkning av monterade köks- och badrumsinredningar
  25120, // Tillverkning av dörrar och fönster av metall
  25720, // Tillverkning av lås och gångjärn
  // — Lyft, kranar, byggmaskiner —
  28220, // Tillverkning av lyft- och godshanteringsanordningar
  // — Sanering, lokalvård, fasadtvätt, fönsterputs —
  81290, // Övrig rengöringsverksamhet (specialrengöring, fasad, sanering)
  81210, // Lokalvård / städning av byggnader
  81221, // Fönsterputsning (B2B)
  // — Trädgård / grönytor —
  81300, // Skötsel och underhåll av grönytor
  // — Betong & grundmaterial för bygg —
  23630, // Tillverkning av fabriksblandad betong
  23610, // Tillverkning av betongvaror för byggändamål
  23690, // Tillverkning av övriga varor av betong, cement och gips
];

/** Set-version för O(1) lookup vid guard-kontroller. */
export const HANTVERK_BRANSCHER_SET: ReadonlySet<number> = new Set(
  HANTVERK_BRANSCHER,
);

/** True om branschid (ng1) tillhör hem- & hantverks-nischen. */
export function isHantverkBransch(ng1: number | null | undefined): boolean {
  if (ng1 == null) return false;
  return HANTVERK_BRANSCHER_SET.has(ng1);
}
