-- =============================================================================
-- hantverk-pafyllning-002.sql: 16232 visas under samma yrke som 16233
-- Beslut 2026-11-23.
--
-- SNI 2007 16232 (dörrar av trä) och 16233 (fönster av trä) är i SNI 2025 en
-- kod, 16250 "dörrar och fönster av trä", som påfyllningen lägger på 16233.
-- De gamla registrets 16232-rader (141 st, varav en kund) visas därför som
-- 16233 i hantverkardelens vy. Registret och foretag_publik ändras inte; andra
-- sajter i klustret ser 16232 som förut.
--
-- Ny version av vyn: foretag_publik delas i två grenar i stället för ett
-- CASE på ng1, så att ett villkor på ng1 fortfarande når indexet
-- (kommun, ng1, aeant) i båda grenarna. Kolumnlistan är oförändrad.
-- Påverkar bara sajten när NEXT_PUBLIC_PAFYLLNING är på.
-- =============================================================================

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
   and not exists (select 1 from public.aesamtable a where a.cfarnr = h.cfarnr);

comment on view public.hantverk_foretag_publik is
  'foretag_publik (16232 visas som 16233) UNION ALL hantverk_pafyllning. Hantverkardelens enda frågeväg när flaggan NEXT_PUBLIC_PAFYLLNING är på.';

grant select on public.hantverk_foretag_publik to anon, authenticated;
