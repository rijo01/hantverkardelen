-- =============================================================================
-- hantverk-pafyllning-003.sql: SCB:s tre spärrfält följer med till påfyllningen
-- 2026-11-24.
--
-- SCB:s företagsregister har tre spärrfält per arbetsställe, i mtoz
-- arbetsstalle.reklamsparr / epostsparr / telefonsparr:
--   reklam_sparr_typ   (ReklamSparrTyp, post)  1 ej spärrat, 2 reklamspärr
--   epost_sparr_typ    (EpostSparrTyp)         1 ej spärrat, 2 spärrat
--   telefon_sparr_typ  (TelefonSparrTyp)       1 ej spärrat, 2 telemarketingspärr, 3 Nix-telefon
-- Koderna lagras som SCB anger dem. Kolumnen reklamsparr (boolean) står kvar
-- och betyder reklam_sparr_typ = 2. Inget av fälten exponeras i vyn.
-- =============================================================================

alter table public.hantverk_pafyllning
  add column if not exists reklam_sparr_typ  smallint check (reklam_sparr_typ in (1, 2)),
  add column if not exists epost_sparr_typ   smallint check (epost_sparr_typ in (1, 2)),
  add column if not exists telefon_sparr_typ smallint check (telefon_sparr_typ in (1, 2, 3));

comment on column public.hantverk_pafyllning.reklam_sparr_typ  is 'SCB ReklamSparrTyp: 1 ej spärrat, 2 reklamspärr (post).';
comment on column public.hantverk_pafyllning.epost_sparr_typ   is 'SCB EpostSparrTyp: 1 ej spärrat, 2 spärrat. Utskick per e-post får inte gå till 2.';
comment on column public.hantverk_pafyllning.telefon_sparr_typ is 'SCB TelefonSparrTyp: 1 ej spärrat, 2 telemarketingspärr, 3 Nix-telefon. Ringlistor får inte ta 2 eller 3.';
