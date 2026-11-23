-- Påfyllningen, omgång 1 (del C, beslut 2026-11-23).
--
-- Aktiva hantverksföretag ur Infofinder (mtoz) som inte finns i det gamla
-- registret kopieras hit av scripts/importera-pafyllning.mjs. Bara
-- hantverkardelen läser tabellen. aesamtable och foretag_publik rörs inte.
--
-- Sajten läser aldrig tabellen direkt: den läser vyn hantverk_foretag_publik,
-- som är foretag_publik UNION ALL de nya raderna, med samma kolumner. Vyn ägs
-- av postgres (som foretag_publik) och kan därför läsa tabellen trots att
-- anon inte får det.
--
-- Vad tabellen INTE innehåller: telefonnummer (H7: inte förrän SCB:s villkor
-- är lästa), personnummer (aldrig, inte heller som hash) och personnamn.
-- E-post lagras men exponeras inte i vyn (samma beslut som telefonen).

begin;

create table if not exists public.hantverk_pafyllning (
  cfarnr          bigint primary key,
  firma           text not null,
  gatuadress      text,
  postnr          integer,
  postort         text,
  kommun          varchar(4),            -- null = saknas och kunde inte härledas
  lan             varchar(2),
  kommun_harledd  boolean not null default false,
  sni2025         text not null,         -- källans kod, för spårbarhet
  ng1             integer not null,      -- sajtens yrkeskod (mappad)
  jurform         integer,
  orgnr           text,                  -- NNNNNN-NNNN, bara juridiska personer
  ar_enskild_firma boolean not null default false,
  aeant           integer not null default 1,  -- arbetsställen för bolaget, för sorteringen
  storleksklass   smallint,
  webb            text,
  epost           text,                  -- exponeras inte i vyn (H7)
  epost_kalla     text,
  verksamhet      text,                  -- Bolagsverkets verksamhetsbeskrivning
  reklamsparr     boolean not null default false,
  omgang          smallint not null,
  kalla           text not null default 'infofinder',
  afr_datum       date,
  importerad      timestamptz not null default now(),
  search_vector   tsvector generated always as
                    (setweight(to_tsvector('swedish_unaccent'::regconfig, coalesce(firma, '')), 'A')) stored,
  constraint hantverk_pafyllning_orgnr_form check (orgnr is null or orgnr ~ '^\d{6}-\d{4}$'),
  constraint hantverk_pafyllning_ingen_ef_orgnr check (not ar_enskild_firma or orgnr is null)
);

comment on table public.hantverk_pafyllning is
  'Hantverkardelens påfyllning ur Infofinder (mtoz). Skrivs bara av scripts/importera-pafyllning.mjs. Läses via vyn hantverk_foretag_publik. Inga telefonnummer, personnummer eller personnamn.';

alter table public.hantverk_pafyllning enable row level security;
revoke all on public.hantverk_pafyllning from anon, authenticated;
-- Bara importen skriver (service_role). Klustrets nya tabeller ärver inte rättigheter.
grant select, insert, update, delete on public.hantverk_pafyllning to service_role;

create index if not exists hantverk_pafyllning_kommun_ng1_aeant
  on public.hantverk_pafyllning (kommun, ng1, aeant desc nulls last);
create index if not exists hantverk_pafyllning_ng1_aeant
  on public.hantverk_pafyllning (ng1, aeant desc nulls last);
create index if not exists hantverk_pafyllning_orgnr
  on public.hantverk_pafyllning (orgnr text_pattern_ops);
create index if not exists hantverk_pafyllning_search_vector
  on public.hantverk_pafyllning using gin (search_vector);
create index if not exists hantverk_pafyllning_firma_trgm
  on public.hantverk_pafyllning using gin (firma gin_trgm_ops);
create index if not exists hantverk_pafyllning_postort_trgm
  on public.hantverk_pafyllning using gin (postort gin_trgm_ops);

-- Den sammanslagna vyn. Kolumnerna är foretag_publiks, i samma ordning, plus
-- fem som bara påfyllningen fyller.
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
  'foretag_publik UNION ALL hantverk_pafyllning. Hantverkardelens enda frågeväg när flaggan NEXT_PUBLIC_PAFYLLNING är på.';

grant select on public.hantverk_foretag_publik to anon, authenticated;

-- Kontaktspärren (kontrakt 1.2) ska nå de nya raderna. Filtret tillämpas i
-- sajten vid läsning (lib/kontaktsparr.ts), oavsett källa. Här läggs
-- påfyllningen till i kontaktsparr_berorda, så att revalideringen hittar
-- sidorna. Funktionen är i övrigt oförändrad (live-definitionen 2026-11-23).
CREATE OR REPLACE FUNCTION public.kontaktsparr_berorda(p_typ text, p_nyckel text)
 RETURNS TABLE(kalla text, falt text, cfarnr bigint, sajt text, entity_type text, external_id text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
 SET enable_seqscan TO 'off'
AS $function$
declare
  k   text := kontaktsparr_kontrollerad_nyckel(p_typ, p_nyckel);
  m   text := kontaktsparr_monster(p_typ, k);
  nal text := kontaktsparr_nal(p_typ, k);
begin
  -- Fyra satser, inte en UNION. Mätt 2026-10-05: var för sig tar delarna
  -- 8 + 157 + 1 + 2 ms; som EN union-fråga valde planeraren en plan som tog
  -- 1 450 ms — och via PostgREST, med anons 3 s-gräns, föll den.
  return query execute format($q$
  select 'aesamtable'::text, f.falt, a.cfarnr::bigint, null::text, null::text, null::text
    from aesamtable a
    cross join lateral (values
      ('tel', a.tel::text), ('tel2', a.tel2::text), ('extratel', a.extratel::text),
      ('telefon', a.telefon::text), ('extratelefon', a.extratelefon),
      ('mobil1', a.mobil1), ('mobil2', a.mobil2),
      ('epostadress', a.epostadress), ('e-post', a."e-post"::text),
      ('kontaktperson', a.kontaktperson::text),
      ('infotext', a.infotext), ('justnu', a.justnu)
    ) f(falt, v)
   where %4$s
     and f.v ~* %3$L
  $q$, p_typ, '%' || nal || '%', m,
    -- Telefon går via indexet (kontaktsparr_siffror), e-post via en skanning.
    case when p_typ = 'telefon'
      then format('kontaktsparr_siffror(a.tel::text, a.tel2::text, a.extratel::text, a.telefon::text, a.extratelefon, a.mobil1, a.mobil2, a.epostadress, a."e-post"::text, a.kontaktperson::text, a.infotext, a.justnu) like %L', '%' || nal || '%')
      else format($e$lower(concat_ws('|', a.tel::text, a.tel2::text, a.extratel::text, a.telefon::text, a.extratelefon, a.mobil1, a.mobil2, a.epostadress, a."e-post"::text, a.kontaktperson::text, a.infotext, a.justnu)) like %L$e$, '%' || nal || '%')
    end);

  return query execute format($q$
  select 'sokordtable', 'sokord', s.cfarnr::bigint, null, null, null
    from sokordtable s
   where kontaktsparr_forfilter(%1$L, coalesce(s.sokord, '') || '|' || coalesce(s.sokordsbanner, '')) like %2$L
     and (s.sokord ~* %3$L or s.sokordsbanner ~* %3$L)
  $q$, p_typ, '%' || nal || '%', m,
    -- Telefon går via indexet (kontaktsparr_siffror), e-post via en skanning.
    case when p_typ = 'telefon'
      then format('kontaktsparr_siffror(a.tel::text, a.tel2::text, a.extratel::text, a.telefon::text, a.extratelefon, a.mobil1, a.mobil2, a.epostadress, a."e-post"::text, a.kontaktperson::text, a.infotext, a.justnu) like %L', '%' || nal || '%')
      else format($e$lower(concat_ws('|', a.tel::text, a.tel2::text, a.extratel::text, a.telefon::text, a.extratelefon, a.mobil1, a.mobil2, a.epostadress, a."e-post"::text, a.kontaktperson::text, a.infotext, a.justnu)) like %L$e$, '%' || nal || '%')
    end);

  return query execute format($q$
  select 'crm_profiles', f.falt, nullif(regexp_replace(c.cfarnr, '\D', '', 'g'), '')::bigint,
         c.site, null, null
    from crm_profiles c
    cross join lateral (values
      ('phone', c.phone), ('infotext', c.infotext), ('keywords', c.keywords::text)
    ) f(falt, v)
   where kontaktsparr_forfilter(%1$L, f.v) like %2$L and f.v ~* %3$L
  $q$, p_typ, '%' || nal || '%', m,
    -- Telefon går via indexet (kontaktsparr_siffror), e-post via en skanning.
    case when p_typ = 'telefon'
      then format('kontaktsparr_siffror(a.tel::text, a.tel2::text, a.extratel::text, a.telefon::text, a.extratelefon, a.mobil1, a.mobil2, a.epostadress, a."e-post"::text, a.kontaktperson::text, a.infotext, a.justnu) like %L', '%' || nal || '%')
      else format($e$lower(concat_ws('|', a.tel::text, a.tel2::text, a.extratel::text, a.telefon::text, a.extratelefon, a.mobil1, a.mobil2, a.epostadress, a."e-post"::text, a.kontaktperson::text, a.infotext, a.justnu)) like %L$e$, '%' || nal || '%')
    end);

  return query execute format($q$
  select 'overlay_profil', f.falt,
         case when o.entity_type = 'arbetsstalle' then nullif(regexp_replace(o.external_id, '\D', '', 'g'), '')::bigint end,
         o.sajt, o.entity_type, o.external_id
    from overlay_profil o
    cross join lateral (values
      ('telefon_override', o.telefon_override), ('epost_override', o.epost_override),
      ('kontaktperson', o.kontaktperson), ('info_html', o.info_html),
      ('keywords', o.keywords::text), ('bas', o.bas::text)
    ) f(falt, v)
   where o.status in ('aktiv','utkast')
     and kontaktsparr_forfilter(%1$L, f.v) like %2$L and f.v ~* %3$L
  $q$, p_typ, '%' || nal || '%', m,
    -- Telefon går via indexet (kontaktsparr_siffror), e-post via en skanning.
    case when p_typ = 'telefon'
      then format('kontaktsparr_siffror(a.tel::text, a.tel2::text, a.extratel::text, a.telefon::text, a.extratelefon, a.mobil1, a.mobil2, a.epostadress, a."e-post"::text, a.kontaktperson::text, a.infotext, a.justnu) like %L', '%' || nal || '%')
      else format($e$lower(concat_ws('|', a.tel::text, a.tel2::text, a.extratel::text, a.telefon::text, a.extratelefon, a.mobil1, a.mobil2, a.epostadress, a."e-post"::text, a.kontaktperson::text, a.infotext, a.justnu)) like %L$e$, '%' || nal || '%')
    end);

  -- Påfyllningen (hantverk_pafyllning, bara hantverkardelen). Liten tabell;
  -- skannas. Telefon finns inte i tabellen, men e-post, webb och
  -- verksamhetsbeskrivningen kan bära en uppgift.
  return query execute format($q$
  select 'hantverk_pafyllning', f.falt, h.cfarnr::bigint, null::text, null::text, null::text
    from hantverk_pafyllning h
    cross join lateral (values
      ('epost', h.epost), ('webb', h.webb), ('verksamhet', h.verksamhet)
    ) f(falt, v)
   where kontaktsparr_forfilter(%1$L, f.v) like %2$L and f.v ~* %3$L
  $q$, p_typ, '%' || nal || '%', m);

end;
$function$;

revoke all on function kontaktsparr_berorda(text, text) from public, anon, authenticated;
grant execute on function kontaktsparr_berorda(text, text) to service_role;

commit;
