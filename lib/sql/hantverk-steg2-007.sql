-- =============================================================================
-- hantverk-steg2-007.sql: datumen för SCB-uppgifterna, för integritetspolicyn.
-- Beslut 2026-11-25.
--
-- hantverk_scb_datum(): SCB:s registerdatum (max afr_datum) och dagen då
-- uppgifterna lästes in hos oss (max importerad) i hantverk_pafyllning.
-- Tabellen är bara läsbar för service_role; funktionen lämnar ut två datum och
-- inget annat, så anon får anropa den.
-- =============================================================================

create or replace function public.hantverk_scb_datum()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('afr', max(afr_datum), 'inlast', (max(importerad) at time zone 'Europe/Stockholm')::date)
    from public.hantverk_pafyllning;
$$;

revoke all on function public.hantverk_scb_datum() from public;
grant execute on function public.hantverk_scb_datum() to anon, authenticated, service_role;
notify pgrst, 'reload schema';
