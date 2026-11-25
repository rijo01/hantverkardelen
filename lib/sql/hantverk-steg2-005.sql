-- =============================================================================
-- hantverk-steg2-005.sql: steg två, andra versionen. Beslut 2026-11-25.
--
-- 1. hantverk_dolda_orgnr: organisationsnumren bakom raderna i foretag_dold.
--    Ett dolt bolag får inte komma tillbaka under ett nytt cfarnr, varken via
--    påfyllningen (vyn hantverk_foretag_publik och importen) eller via steg
--    två (hantverk_foretag_steg2). Bara organisationsnummer: tredje siffran
--    2–9 och aldrig jurform 10. Personnummer läses aldrig ut och jämförs
--    aldrig. Vyn är bara utlämnad till service_role.
-- 2. hantverk_foretag_publik: påfyllningens rader med ett dolt orgnr tas bort.
--    I övrigt samma definition som hantverk-pafyllning-002.sql.
-- 3. hantverk_foretag_steg2 byggs om:
--    - search_vector för rader som visas med SCB:s namn = SCB:s namn plus det
--      tidigare namnet, så att sökningen hittar det namn som visas och det gamla.
--    - rader med ett dolt orgnr visas inte (kunder undantagna).
-- 4. hantverk_korning: logg över skriptens körningar (nödbromsen jämför med
--    förra körningen, och det är där en daglig körning syns).
--
-- Produktionen läser foretag_publik och påverkas inte av något här.
-- =============================================================================

-- ---- 1. Dolda organisationsnummer -------------------------------------------

create or replace view public.hantverk_dolda_orgnr as
select distinct o.orgnr
  from (
    select right(s.peorgnr::text, 10) as orgnr
      from public.foretag_dold d
      join public.aesamtable s on s.cfarnr = d.cfarnr
     where s.jurform is distinct from 10 and s.peorgnr is not null
    union all
    select replace(h.orgnr, '-', '')
      from public.foretag_dold d
      join public.hantverk_pafyllning h on h.cfarnr = d.cfarnr
     where h.orgnr is not null
  ) o
 where o.orgnr ~ '^\d{2}[2-9]\d{7}$';   -- organisationsnummerform, aldrig personnummer

comment on view public.hantverk_dolda_orgnr is
  'Organisationsnummer (10 siffror) bakom raderna i foretag_dold. Bara organisationsnummerform. Läses av importen och vyerna, aldrig av sajten.';
revoke all on public.hantverk_dolda_orgnr from anon, authenticated;
grant select on public.hantverk_dolda_orgnr to service_role;

-- ---- 2. Påfyllningens vy -----------------------------------------------------

create or replace view public.hantverk_foretag_publik as
select p.id, p.cfarnr, p.firma::text as firma, p.namn::text as namn, p.gatuadress::text as gatuadress,
       p.postnr, p.postort::text as postort, p.ort::text as ort, p.tel::text as tel, p.telefon::text as telefon,
       p.epostadress::text as epostadress, p.webb::text as webb, p.lank::text as lank,
       p.ng1, p.branschid, p.kommun::text as kommun, p.lan::text as lan, p.aeant,
       p.orgnr, p.ar_enskild_firma, p.jurform, p.search_vector, p.infotext, p.logotyp::text as logotyp,
       p.kontaktperson::text as kontaktperson, p.poang, p.orgnr_maskerat, p.aeant_per_stalle,
       null::smallint as storleksklass, 'register2011'::text as kalla, false as kommun_harledd,
       null::text as verksamhet, null::date as uppdaterad
  from public.foretag_publik p
 where p.ng1 is distinct from 16232
union all
-- 16232 dörrar av trä -> 16233 (samma yrke, "Dörrar & fönster av trä")
select p.id, p.cfarnr, p.firma::text, p.namn::text, p.gatuadress::text,
       p.postnr, p.postort::text, p.ort::text, p.tel::text, p.telefon::text,
       p.epostadress::text, p.webb::text, p.lank::text,
       16233, p.branschid, p.kommun::text, p.lan::text, p.aeant,
       p.orgnr, p.ar_enskild_firma, p.jurform, p.search_vector, p.infotext, p.logotyp::text,
       p.kontaktperson::text, p.poang, p.orgnr_maskerat, p.aeant_per_stalle,
       null::smallint, 'register2011'::text, false,
       null::text, null::date
  from public.foretag_publik p
 where p.ng1 = 16232
union all
select null::integer, h.cfarnr, h.firma, null::text, h.gatuadress,
       h.postnr, h.postort, null::text, null::text, null::text,
       null::text,                       -- e-post exponeras inte (H7)
       h.webb, null::text,
       h.ng1, null::integer, h.kommun::text, h.lan::text, h.aeant,
       h.orgnr, h.ar_enskild_firma, h.jurform, h.search_vector, null::text, null::text,
       null::text, 0, null::text, h.aeant,
       h.storleksklass, h.kalla, h.kommun_harledd,
       h.verksamhet, h.afr_datum
  from public.hantverk_pafyllning h
 where not exists (select 1 from public.foretag_dold d where d.cfarnr = h.cfarnr)
   -- Skydd mot dubblett: får det gamla registret raden visas den bara därifrån.
   and not exists (select 1 from public.aesamtable a where a.cfarnr = h.cfarnr)
   -- Ett dolt bolag kommer inte tillbaka under ett nytt cfarnr.
   and not exists (select 1 from public.hantverk_dolda_orgnr o where o.orgnr = replace(h.orgnr, '-', ''));

comment on view public.hantverk_foretag_publik is
  'foretag_publik (16232 visas som 16233) UNION ALL hantverk_pafyllning utan dolda bolag. Hantverkardelens frågeväg när NEXT_PUBLIC_PAFYLLNING är på.';
grant select on public.hantverk_foretag_publik to anon, authenticated;

-- ---- 3. Steg två-vyn -----------------------------------------------------------

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
       case when s.utfall = 'visas' then s.afr_datum else v.uppdaterad end as uppdaterad
  from public.hantverk_foretag_publik v
  left join public.hantverk_steg2 s on s.cfarnr = v.cfarnr and v.kalla = 'register2011'
 where (s.cfarnr is null or s.utfall = 'visas' or coalesce(v.poang, 0) > 0)  -- kunder visas alltid
   -- Ett dolt bolag kommer inte tillbaka under ett annat cfarnr (kunder undantagna).
   and (coalesce(v.poang, 0) > 0 or v.orgnr is null
        or not exists (select 1 from public.hantverk_dolda_orgnr o where o.orgnr = replace(v.orgnr, '-', '')))
   -- Sajtens yrken (HANTVERK_BRANSCHER i src/lib/hantverk-branscher.ts).
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
  'Steg två: hantverk_foretag_publik utan rader som inte är verksamma i SCB eller saknar hantverkskod där, med SCB:s uppgifter på verksamma rader. Läses när NEXT_PUBLIC_STEG2 är på. Byggs om av scripts/steg2-upphorda.mjs.';
grant select on public.hantverk_foretag_steg2 to anon, authenticated, service_role;

-- ---- 4. Körloggen ----------------------------------------------------------------

create table if not exists public.hantverk_korning (
  id            bigint generated always as identity primary key,
  skript        text not null check (skript in ('pafyllning', 'steg2')),
  startad       timestamptz not null default now(),
  klar          timestamptz,
  status        text not null check (status in ('pagar', 'klar', 'stoppad', 'fel', 'torrkorning')),
  tvingad       boolean not null default false,
  afr_datum     date,
  scb_verksamma integer,          -- verksamma arbetsställen i mtoz vid körningen
  visade_fore   integer,          -- rader skriptet styr som visades före körningen
  visade_efter  integer,
  doljs         integer,          -- visades före, visas inte efter
  orsak         text              -- varför en körning stoppades eller föll
);
comment on table public.hantverk_korning is
  'Logg för scripts/importera-pafyllning.mjs och scripts/steg2-upphorda.mjs. Nödbromsen jämför med senaste körningen med status klar.';
alter table public.hantverk_korning enable row level security;
revoke all on public.hantverk_korning from anon, authenticated;
grant select, insert, update on public.hantverk_korning to service_role;
