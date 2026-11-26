-- =============================================================================
-- hantverk-steg2-008.sql: har_webb, för sorteringsvariant b (provas på preview).
-- Beslut 2026-11-26.
--
-- Beräknad kolumn för PostgREST: har_webb(hantverk_foretag_steg2) är true när
-- raden har en hemsida (webb). Listorna kan då sortera "företag med hemsida
-- före övriga" (order=har_webb.desc) utan att den materialiserade vyn byggs om.
-- Läggs bara till; ändrar inget som sajten läser i dag.
-- =============================================================================

create or replace function public.har_webb(r public.hantverk_foretag_steg2)
returns boolean
language sql
immutable
set search_path = public
as $$
  select nullif(trim(r.webb), '') is not null;
$$;

comment on function public.har_webb(public.hantverk_foretag_steg2) is
  'Beräknad kolumn: raden har en hemsida. Sorteringsvariant b (NEXT_PUBLIC_SORTERING=b).';
grant execute on function public.har_webb(public.hantverk_foretag_steg2) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
