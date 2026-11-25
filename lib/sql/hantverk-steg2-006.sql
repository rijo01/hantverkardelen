-- =============================================================================
-- hantverk-steg2-006.sql: bikoder sorteras sist, antalen i databasen.
-- Beslut 2026-11-25.
--
-- 1. hantverk_steg2.bikod: raden visas bara tack vare en bikod i SCB (huvudkoden
--    är inte ett av sajtens yrken). Sådana rader står kvar men sorteras efter
--    rader med hantverk som huvudkod: vyn får kolumnen huvudkod_hantverk.
--    Tillkommande rader kräver hantverkskod som huvudkod (skriptet).
-- 2. hantverk_antal: antal företag per kommun × yrke i hantverk_foretag_steg2.
--    Sajten läser antalen härifrån när steg två är på, så att antal och grind
--    uppdateras utan deploy.
-- 3. hantverk_steg2_bygg_om(): bygger om vyn och antalen i en transaktion.
--    Bara service_role får anropa den. Ersätter Supabase CLI i skriptet.
-- =============================================================================

alter table public.hantverk_steg2 add column if not exists bikod boolean not null default false;
comment on column public.hantverk_steg2.bikod is
  'true = visas bara tack vare en bikod i SCB (huvudkoden är inte ett av sajtens yrken). Sorteras sist.';

drop materialized view if exists public.hantverk_foretag_steg2;

create materialized view public.hantverk_foretag_steg2 as
select v.id, v.cfarnr,
       case when s.utfall = 'visas' and s.firma is not null then s.firma else v.firma end as firma,
       v.namn,
       case when s.utfall = 'visas' then coalesce(s.gatuadress, v.gatuadress) else v.gatuadress end as gatuadress,
       case when s.utfall = 'visas' then coalesce(s.postnr, v.postnr) else v.postnr end as postnr,
       case when s.utfall = 'visas' then coalesce(s.postort, v.postort) else v.postort end as postort,
       v.ort, v.tel, v.telefon, v.epostadress, v.webb, v.lank,
       case when s.utfall = 'visas' then coalesce(s.ng1, v.ng1) else v.ng1 end as ng1,
       v.branschid,
       case when s.utfall = 'visas' then coalesce(s.kommun, v.kommun) else v.kommun end as kommun,
       case when s.utfall = 'visas' then coalesce(s.lan, v.lan) else v.lan end as lan,
       v.aeant, v.orgnr, v.ar_enskild_firma, v.jurform,
       -- Sökningen ska hitta namnet som visas, och gärna det tidigare.
       case when s.utfall = 'visas' and s.firma is not null
            then setweight(to_tsvector('swedish_unaccent'::regconfig, s.firma), 'A') || coalesce(v.search_vector, ''::tsvector)
            else v.search_vector end as search_vector,
       v.infotext, v.logotyp,
       v.kontaktperson, v.poang, v.orgnr_maskerat, v.aeant_per_stalle,
       case when s.utfall = 'visas' then coalesce(s.storleksklass, v.storleksklass) else v.storleksklass end as storleksklass,
       case when s.utfall = 'visas' then 'register_scb' else v.kalla end as kalla,
       v.kommun_harledd, v.verksamhet,
       case when s.utfall = 'visas' then s.afr_datum else v.uppdaterad end as uppdaterad,
       -- Rader med hantverk som SCB:s huvudkod sorteras före rader som bara har det som bikod.
       not coalesce(s.utfall = 'visas' and s.bikod, false) as huvudkod_hantverk
  from public.hantverk_foretag_publik v
  left join public.hantverk_steg2 s on s.cfarnr = v.cfarnr and v.kalla = 'register2011'
 where (s.cfarnr is null or s.utfall = 'visas' or coalesce(v.poang, 0) > 0)  -- kunder visas alltid
   and (coalesce(v.poang, 0) > 0 or v.orgnr is null
        or not exists (select 1 from public.hantverk_dolda_orgnr o where o.orgnr = replace(v.orgnr, '-', '')))
   and (case when s.utfall = 'visas' then coalesce(s.ng1, v.ng1) else v.ng1 end) in
       (41200,43999,16231,43210,43120,43110,42110,42120,42210,42220,42910,42990,43221,43222,43223,
        43290,43341,43330,43911,43912,43342,43310,43320,16233,25120,81300,23630,23610,23690)
with no data;

create unique index hantverk_foretag_steg2_cfarnr on public.hantverk_foretag_steg2 (cfarnr);
create index hantverk_foretag_steg2_kommun_ng1 on public.hantverk_foretag_steg2 (kommun, ng1, aeant desc nulls last);
create index hantverk_foretag_steg2_ng1 on public.hantverk_foretag_steg2 (ng1, aeant desc nulls last);
create index hantverk_foretag_steg2_orgnr on public.hantverk_foretag_steg2 (orgnr);
create index hantverk_foretag_steg2_kund on public.hantverk_foretag_steg2 (poang) where poang > 0;
create index hantverk_foretag_steg2_sok on public.hantverk_foretag_steg2 using gin (search_vector);

comment on materialized view public.hantverk_foretag_steg2 is
  'Steg två: hantverk_foretag_publik utan rader som inte är verksamma i SCB eller saknar hantverkskod där, med SCB:s uppgifter på verksamma rader. Läses när NEXT_PUBLIC_STEG2 är på. Byggs om av hantverk_steg2_bygg_om().';
grant select on public.hantverk_foretag_steg2 to anon, authenticated, service_role;

-- ---- 2. Antalen ------------------------------------------------------------------

create table if not exists public.hantverk_antal (
  kommun      text not null,
  ng1         integer not null,
  n           integer not null,
  uppdaterad  timestamptz not null default now(),
  primary key (kommun, ng1)
);
comment on table public.hantverk_antal is
  'Antal företag per kommun × yrke i hantverk_foretag_steg2 (rader med kommun, utan offentlig sektor). Skrivs bara av hantverk_steg2_bygg_om(). Sajten läser den när steg två är på (src/lib/antal.ts).';
alter table public.hantverk_antal enable row level security;
drop policy if exists hantverk_antal_las on public.hantverk_antal;
create policy hantverk_antal_las on public.hantverk_antal for select to anon, authenticated using (true);
revoke all on public.hantverk_antal from anon, authenticated;
grant select on public.hantverk_antal to anon, authenticated, service_role;

-- ---- 3. Ombyggnaden ----------------------------------------------------------------

create or replace function public.hantverk_steg2_bygg_om(p_offentliga integer[])
returns json
language plpgsql
security definer
set search_path = public
set statement_timeout = '900s'
as $$
declare
  fylld boolean;
  antal integer;
  rader integer;
begin
  select ispopulated into fylld from pg_matviews where schemaname = 'public' and matviewname = 'hantverk_foretag_steg2';
  if fylld then
    refresh materialized view concurrently public.hantverk_foretag_steg2;
  else
    refresh materialized view public.hantverk_foretag_steg2;
  end if;

  delete from public.hantverk_antal where true;  -- safeupdate kräver where
  insert into public.hantverk_antal (kommun, ng1, n)
  select kommun, ng1, count(*)::int
    from public.hantverk_foretag_steg2
   where kommun is not null
     and (jurform is null or jurform <> all(p_offentliga) or orgnr is null or orgnr not like '2%')
   group by 1, 2;
  get diagnostics antal = row_count;
  select coalesce(sum(n), 0) into rader from public.hantverk_antal;
  return json_build_object('kommun_yrke', antal, 'foretag', rader);
end;
$$;

revoke all on function public.hantverk_steg2_bygg_om(integer[]) from public, anon, authenticated;
grant execute on function public.hantverk_steg2_bygg_om(integer[]) to service_role;
