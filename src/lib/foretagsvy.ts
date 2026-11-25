import { PAFYLLNING, STEG2 } from "./flaggor";

/**
 * Vyn sajten läser företag ur — EN frågeväg för listor, sök, sökförslag,
 * paginering, profilsidor och sitemap.
 *
 *   flaggan AV: `foretag_publik` (det gamla registret, som förut)
 *   flaggan PÅ: `hantverk_foretag_publik` = `foretag_publik` UNION ALL de nya
 *               raderna i `hantverk_pafyllning` (lib/sql/hantverk-pafyllning-001.sql)
 *   steg två PÅ: `hantverk_foretag_steg2`, samma kolumner, materialiserad: det
 *               köpta registrets rader som inte är verksamma i SCB är borta, de
 *               verksamma bär SCB:s uppgifter (lib/sql/hantverk-steg2-004.sql)
 *
 * Ingen av vyerna läser mtoz. Skripten kopierar dit (scripts/importera-pafyllning.mjs,
 * scripts/steg2-upphorda.mjs).
 */
export const FORETAG_VY = STEG2
  ? "hantverk_foretag_steg2"
  : PAFYLLNING
    ? "hantverk_foretag_publik"
    : "foretag_publik";

/** Kolumner som bara den sammanslagna vyn har. Tom sträng när flaggan är av. */
export const PAFYLLNING_KOLUMNER = PAFYLLNING
  ? ",storleksklass,kalla,kommun_harledd,verksamhet,uppdaterad"
  : "";
