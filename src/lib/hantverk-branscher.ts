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
  16233, // Tillverkning av monterade köks- och badrumsinredningar
  25120, // Tillverkning av dörrar och fönster av metall
  // — Trädgård / grönytor —
  81300, // Skötsel och underhåll av grönytor
  // — Betong & grundmaterial för bygg —
  23630, // Tillverkning av fabriksblandad betong
  23610, // Tillverkning av betongvaror för byggändamål
  23690, // Tillverkning av övriga varor av betong, cement och gips
  // Borttagna 2026-05-26 — fyllde katalogen med industri/storkund som inte är hantverkare:
  //   16239  Tillverkning av byggnadssnickerier (Samhall, Setra, Derome, Inwido)
  //   25720  Tillverkning av lås och gångjärn (ASSA, KABA — industri, inte låssmed)
  //   28220  Tillverkning av lyft- och godshanteringsanordningar (Bosch Rexroth, Kalmar Industries)
  //   81210  Lokalvård / städning (Samhall × 30+ arbetsställen, ISS m.fl.)
  //   81221  Fönsterputsning B2B (ISS, SITA — stora servicebolag)
  //   81290  Övrig rengöringsverksamhet/sanering (kommunala renhållningsförvaltningar)
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

/**
 * Offentliga juridiska former: 81 Statlig enhet, 82 Kommun,
 * 83 Kommunalförbund, 84 Region. Samma koder som vårddelens
 * OFFENTLIGA_JURFORMER.
 *
 * Mätt 21 okt 2026 i foretag_publik inom HANTVERK_BRANSCHER: 752 rader har
 * 81–83 (inga 84). Nästan alla är Vägverket, Banverket och kommunernas egna
 * gatu-, park- och VA-förvaltningar under 42110, 42120, 42990 och 81300 —
 * "Kungälvs kommun" en gång per förvaltning. De är inte hantverkare man kan
 * anlita.
 */
export const OFFENTLIGA_JURFORMER: readonly number[] = [81, 82, 83, 84];

/**
 * PostgREST-villkor att lägga på VARJE publik fråga mot foretag_publik bredvid
 * .in("ng1", HANTVERK_BRANSCHER): "inte offentlig juridisk form, eller okänd
 * form, eller inget offentligt organisationsnummer".
 *
 * Organisationsnumret är en spärr mot fel i källan. Fyra rader har offentlig
 * jurform men ett privat nummer — tre aktiebolag (55…: Svevia AB,
 * E.L Betonghåltagning AB, K Sjuntorps Mark & Anläggning) och en enskild firma
 * (Perdegårds Bygg). Offentliga organisationer har nummer som börjar på 2
 * (20 stat, 21 kommun, 22 kommunalförbund, 23 region); privata aldrig. Bara
 * rader där BÅDA säger offentlig filtreras bort, så ingen privat firma
 * försvinner på en felkodad jurform. Rader utan jurform (20 st) behålls.
 *
 * Flera .or() i samma fråga AND:as av PostgREST, så villkoret kan läggas
 * bredvid ett befintligt .or().
 */
export const NISCH_JURFORM_VILLKOR = `jurform.not.in.(${OFFENTLIGA_JURFORMER.join(",")}),jurform.is.null,orgnr.not.like.2*,orgnr.is.null`;
