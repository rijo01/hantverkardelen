-- Påfyllningen, omgång 1: kandidater ur mtoz (Infofinder). Bara läsning.
-- Körs av scripts/importera-pafyllning.mjs i en READ ONLY-transaktion och
-- skrivs som CSV. Uteslutningen mot det gamla registret (cfarnr och orgnr)
-- görs i skriptet, eftersom mtoz och klusterdatabasen inte kan joinas.
--
-- Inga telefonnummer. Inga personnummer: bara ar_fysisk_person = false, och
-- ett orgnr med 0/1 på tredje plats (personnummerform, t.ex. dödsbon) tas inte med.
-- E-post: bara funktionsadresser (lokaldel ur listan nedan) på egen domän utan
-- epostspärr. Källan är SCB (foretag.kalla); exponeras inte på sajten (H7).
copy (
with karta as (               -- postnummer -> kommun ur AFR (H6). Bara entydiga postnummer.
  select besok_postnr pn, min(kommun) kommun
  from arbetsstalle
  where kommun <> '0000' and besok_postnr ~ '^[0-9]{5}$'
  group by 1 having count(distinct kommun) = 1),
stallen as (                  -- verksamma arbetsställen per bolag, för sorteringen (sajtens aeant)
  select orgnr, count(*)::int antal from arbetsstalle
  where aestat = 1 and borta_ur_afr is null and not ar_fysisk_person
  group by 1)
select
  a.cfarnr,
  a.orgnr,
  coalesce(nullif(trim(f.namn),''), nullif(trim(fk.namn),''), nullif(trim(a.benamning),'')) as namn,
  coalesce(nullif(trim(a.besok_gatuadress),''), nullif(trim(a.post_gatuadress),'')) as gatuadress,
  case when a.besok_postnr ~ '^[0-9]{5}$' and a.besok_postnr <> '00000' then a.besok_postnr
       when a.post_postnr  ~ '^[0-9]{5}$' and a.post_postnr  <> '00000' then a.post_postnr end as postnr,
  coalesce(nullif(trim(a.besok_postort),''), nullif(trim(a.post_postort),'')) as postort,
  case when a.kommun <> '0000' then a.kommun else k.kommun end as kommun,
  (a.kommun = '0000' and k.kommun is not null)              as kommun_harledd,
  a.sni_primar                                              as sni2025,
  a.anstkl                                                  as storleksklass,
  coalesce(nullif(f.juridisk_form,''), nullif(fk.juridisk_form,''), nullif(fk.bolagsform,'')) as juridisk_form,
  coalesce(s.antal, 1)                                      as aeant,
  a.reklamsparr,
  a.epostsparr,
  a.telefonsparr,
  case when a.epostsparr is distinct from 2
        and split_part(lower(trim(f.email)),'@',1) in
            ('info','kontakt','kontakta','kontor','offert','order','mail','post','hej','hello','sales',
             'forsaljning','support','kundtjanst','kundservice','ekonomi','faktura','fakturor','reception',
             'office','kansli','admin','bokning','boka','service','shop','butik','verkstad','expedition',
             'reklam','press')
        and lower(trim(f.email)) !~* '@(?:[a-z0-9-]+\.)*(?:hotmail|gmail|googlemail|yahoo|ymail|live|outlook|msn|icloud|me|mac|aol|gmx|yandex|protonmail|proton|mail|telia|spray|bredband|bredband2|bbb|comhem|tele2|tele2sverige|passagen|swipnet|glocalnet|home|telenordia|tiscali|algonet|chello|bahnhof|ownit|euromail|tdcnet|privat|jippii|boxer|telenor|bostream)\.[a-z]{2,4}$'
       then lower(trim(f.email)) end                        as epost,
  f.kalla                                                   as epost_kalla,
  coalesce(nullif(trim(c.website),''), nullif(trim(f.hemsida),''), nullif(trim(fk.hemsida),'')) as hemsida,
  nullif(trim(fk.verksamhetsbeskrivning),'')                as verksamhet,
  (select max(afr_datum) from arbetsstalle_lasning)         as afr_datum
from arbetsstalle a
left join foretag      f  on f.orgnr  = a.orgnr
left join fk_companies fk on fk.orgnr = a.orgnr
left join fk_contact   c  on c.orgnr  = a.orgnr
left join stallen      s  on s.orgnr  = a.orgnr
left join karta        k  on k.pn = case when a.besok_postnr ~ '^[0-9]{5}$' and a.besok_postnr <> '00000' then a.besok_postnr
                                         when a.post_postnr  ~ '^[0-9]{5}$' and a.post_postnr  <> '00000' then a.post_postnr end
where a.aestat = 1
  and a.borta_ur_afr is null
  and not a.ar_fysisk_person
  and a.orgnr ~ '^[0-9]{2}[2-9][0-9]{7}$'                   -- organisationsnummerform, aldrig personnummerform
  and left(a.orgnr,2) not in ('20','21','22','23')          -- inte offentlig sektor
  and coalesce(nullif(trim(f.namn),''), nullif(trim(fk.namn),''), nullif(trim(a.benamning),'')) is not null
  and (fk.status = 'aktiv' or fk.status is null)
  and a.sni_primar in ('41000','43999','16231','43210','43120','43110','42110','42120','42210','42221','42222',
                       '42910','42990','43221','43222','43223','43230','43240','43341','43330','43411','43412',
                       '43342','43310','43320','16250','25120','81300','23630','23610','23660','43350','43910',
                       '43229','43420','43500')
order by a.cfarnr
) to stdout with (format csv, header);
