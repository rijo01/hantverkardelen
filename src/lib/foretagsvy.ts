import { PAFYLLNING } from "./flaggor";

/**
 * Vyn sajten läser företag ur — EN frågeväg för listor, sök, sökförslag,
 * paginering, profilsidor och sitemap.
 *
 *   flaggan AV: `foretag_publik` (det gamla registret, som förut)
 *   flaggan PÅ: `hantverk_foretag_publik` = `foretag_publik` UNION ALL de nya
 *               raderna i `hantverk_pafyllning` (lib/sql/hantverk-pafyllning-001.sql)
 *
 * Ingen av vyerna läser mtoz. Importen kopierar dit (scripts/importera-pafyllning.mjs).
 */
export const FORETAG_VY = PAFYLLNING ? "hantverk_foretag_publik" : "foretag_publik";

/** Kolumner som bara den sammanslagna vyn har. Tom sträng när flaggan är av. */
export const PAFYLLNING_KOLUMNER = PAFYLLNING
  ? ",storleksklass,kalla,kommun_harledd,verksamhet,uppdaterad"
  : "";
