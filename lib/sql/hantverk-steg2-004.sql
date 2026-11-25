-- =============================================================================
-- hantverk-steg2-004.sql: steg två. Rader ur det köpta registret som inte är
-- verksamma i SCB:s register döljs (404) eller pekar på sin efterföljare (308).
-- Beslut 2026-11-24.
--
-- Två nya objekt, inget befintligt ändras:
--
--   hantverk_steg2            utfallet per rad i det köpta registret, skrivet
--                             av scripts/steg2-upphorda.mjs. Kunder (poang > 0
--                             eller overlay-profil) står aldrig här.
--   hantverk_foretag_steg2    MATERIALISERAD vy = hantverk_foretag_publik där
--                             dolda rader är borta och verksamma rader bär
--                             SCB:s namn, adress, bransch och storleksklass.
--
-- Sajten läser vyn bara när flaggorna NEXT_PUBLIC_PAFYLLNING och
-- NEXT_PUBLIC_STEG2 båda är på (src/lib/foretagsvy.ts). Produktionen läser
-- foretag_publik och påverkas inte.
--
-- Varför materialiserad: kommun och ng1 kan komma från SCB, och ett villkor
-- på coalesce(...) når inte registrets index. Vyn byggs om av skripten
-- (steg2-upphorda.mjs och importera-pafyllning.mjs) med
-- `refresh materialized view concurrently`. aesamtable ändras aldrig, så
-- poang (kundstatus) ändras inte mellan körningarna.
-- =============================================================================

create table if not exists public.hantverk_steg2 (
  cfarnr          bigint primary key,
  utfall          text not null check (utfall in ('visas', '404', '308')),
  -- Hur utfallet avgjordes: scb_verksam | orgnr | namn | telefon | adress | inget
  via             text not null,
  mal_cfarnr      bigint,
  -- SCB:s uppgifter för verksamma rader (utfall 'visas'); null annars.
  firma           text,
  gatuadress      text,
  postnr          integer,
  postort         text,
  kommun          text,
  lan             text,
  ng1             integer,
  storleksklass   smallint,
  afr_datum       date,
  -- Registrets kommun och yrke (vyns ng1), för 404-sidans länk.
  kommun_register text,
  ng1_register    integer,
  kord_at         timestamptz not null default now(),
  constraint hantverk_steg2_mal check ((utfall = '308') = (mal_cfarnr is not null))
);

comment on table public.hantverk_steg2 is
  'Steg två: utfall per rad i det köpta registret (visas/404/308). Skrivs bara av scripts/steg2-upphorda.mjs. Kunder står aldrig här.';

alter table public.hantverk_steg2 enable row level security;
drop policy if exists hantverk_steg2_las on public.hantverk_steg2;
create policy hantverk_steg2_las on public.hantverk_steg2 for select to anon, authenticated using (true);
-- anon ser bara det 404/308-svaret behöver.
revoke all on public.hantverk_steg2 from anon, authenticated;
grant select (cfarnr, utfall, mal_cfarnr, kommun_register, ng1_register) on public.hantverk_steg2 to anon, authenticated;
-- Skriptet skriver med service role.
grant select, insert, update, delete on public.hantverk_steg2 to service_role;

create materialized view if not exists public.hantverk_foretag_steg2 as
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
       v.aeant, v.orgnr, v.ar_enskild_firma, v.jurform, v.search_vector, v.infotext, v.logotyp,
       v.kontaktperson, v.poang, v.orgnr_maskerat, v.aeant_per_stalle,
       case when s.utfall = 'visas' then coalesce(s.storleksklass, v.storleksklass) else v.storleksklass end as storleksklass,
       case when s.utfall = 'visas' then 'register_scb' else v.kalla end as kalla,
       v.kommun_harledd, v.verksamhet,
       case when s.utfall = 'visas' then s.afr_datum else v.uppdaterad end as uppdaterad
  from public.hantverk_foretag_publik v
  left join public.hantverk_steg2 s on s.cfarnr = v.cfarnr and v.kalla = 'register2011'
 where (s.cfarnr is null or s.utfall = 'visas' or coalesce(v.poang, 0) > 0)  -- kunder visas alltid
   -- Sajtens yrken (HANTVERK_BRANSCHER i src/lib/hantverk-branscher.ts).
   and (case when s.utfall = 'visas' then coalesce(s.ng1, v.ng1) else v.ng1 end) in
       (41200,43999,16231,43210,43120,43110,42110,42120,42210,42220,42910,42990,43221,43222,43223,
        43290,43341,43330,43911,43912,43342,43310,43320,16233,25120,81300,23630,23610,23690)
with no data;

create unique index if not exists hantverk_foretag_steg2_cfarnr on public.hantverk_foretag_steg2 (cfarnr);
create index if not exists hantverk_foretag_steg2_kommun_ng1 on public.hantverk_foretag_steg2 (kommun, ng1, aeant desc nulls last);
create index if not exists hantverk_foretag_steg2_ng1 on public.hantverk_foretag_steg2 (ng1, aeant desc nulls last);
create index if not exists hantverk_foretag_steg2_orgnr on public.hantverk_foretag_steg2 (orgnr);
create index if not exists hantverk_foretag_steg2_kund on public.hantverk_foretag_steg2 (poang) where poang > 0;
create index if not exists hantverk_foretag_steg2_sok on public.hantverk_foretag_steg2 using gin (search_vector);

comment on materialized view public.hantverk_foretag_steg2 is
  'Steg två: hantverk_foretag_publik utan rader som inte är verksamma i SCB, och med SCB:s uppgifter på verksamma rader. Läses när NEXT_PUBLIC_STEG2 är på. Byggs om av scripts/steg2-upphorda.mjs.';

grant select on public.hantverk_foretag_steg2 to anon, authenticated, service_role;
