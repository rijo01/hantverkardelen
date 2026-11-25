// Steg två: rader ur det köpta registret som inte är verksamma i SCB:s register
// döljs (404) eller pekar på sin efterföljare (308). Beslut 2026-11-24.
//
//   node --env-file=.env.local scripts/steg2-upphorda.mjs [--torrkorning] [--tvinga] [--revalidera <bas-url>]
//
// Körs EFTER scripts/importera-pafyllning.mjs, och om efter varje inläsning från
// SCB: en rad som blivit verksam igen tas bort ur listan och visas igen, en ny
// upphörd försvinner.
//
// Regeln (beslut 2026-11-24 och 2026-11-25):
//   - En rad visas bara om arbetsstället (cfarnr) är verksamt i SCB:s register i
//     mtoz (aestat = 1, inte borta ur filen) OCH har en hantverkskod bland SCB:s
//     näringsgrenar: huvudkoden, annars den första bikoden (arbetsstalle_sni,
//     i rangordning) som är ett av sajtens yrken. Den visas under det yrket med
//     SCB:s namn (juridiska personer; enskilda firmor behåller registrets namn),
//     adress, kommun och storleksklass.
//   - Verksam men utan hantverkskod i SCB: 404.
//     En bikod räcker för att stanna kvar, inte för att komma in: rader som
//     bara har hantverk som bikod sorteras efter dem som har det som huvudkod.
//   - Ett arbetsställe som ligger i det köpta registret under en kod utanför
//     sajten, men har hantverkskod som SCB:s HUVUDKOD, visas (juridiska
//     personer; enskilda firmor kommer med omgång 2).
//   - Ett bolag vars orgnr hör till en dold rad (foretag_dold) visas inte.
//   - Inte verksam: en efterföljare som redan finns på sajten, i ordningen
//     samma orgnr → samma namn i samma postnummer → samma telefonnummer.
//     Finns den: 308 dit. Annars 404.
//   - Kunder (poang > 0 eller en overlay-profil på cfarnr eller orgnr) rörs
//     aldrig och skrivs inte i tabellen.
//
// Läser: foretag_publik (anon), overlay_profil och hantverk_pafyllning (service
// role), mtoz (READ ONLY). Skriver: hantverk_steg2, bygger om den
// materialiserade vyn hantverk_foretag_steg2 och antalen i hantverk_antal
// (databasfunktionen hantverk_steg2_bygg_om) och skriver reservfilen
// src/lib/seo-snapshot-steg2.ts. aesamtable och vyerna ändras aldrig.
//
// Nödbroms (scripts/korlogg.mjs): skriptet skriver inget om SCB-underlaget är
// under 98 % av förra läsningen eller om körningen skulle dölja fler än 2 % av
// de rader som visades efter förra körningen. --tvinga kör ändå.
//
// Namn, adresser och nummer stannar i minnet; rapporten har bara antal.

import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { korlogg, SCB_UNDERLAG_SQL } from "./korlogg.mjs";

const TORR = process.argv.includes("--torrkorning");
const TVINGA = process.argv.includes("--tvinga");
const argv = process.argv.slice(2);
const REVALIDERA = argv.includes("--revalidera") ? argv[argv.indexOf("--revalidera") + 1] : null;

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPA || !SR || !ANON) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY och SUPABASE_SERVICE_ROLE_KEY krävs.");
  process.exit(1);
}
const H_SR = { apikey: SR, Authorization: `Bearer ${SR}`, "content-type": "application/json" };
const H_ANON = { apikey: ANON, Authorization: `Bearer ${ANON}` };

// ---- Sajtens yrken och organisationsfilter -----------------------------------

const src = (rel) => readFileSync(new URL(`../src/lib/${rel}`, import.meta.url), "utf8");
const hb = src("hantverk-branscher.ts");
const NISCH = [];
for (const line of hb.match(/export const HANTVERK_BRANSCHER[^=]*=\s*\[([\s\S]*?)\];/)[1].split("\n")) {
  const k = line.replace(/\/\/.*$/, "").trim().match(/^(\d+)\s*,?$/);
  if (k) NISCH.push(Number(k[1]));
}
const NISCH_SET = new Set(NISCH);
const OFFENTLIGA = hb.match(/OFFENTLIGA_JURFORMER[^=]*=\s*\[([^\]]*)\]/)[1].replace(/\s/g, "");
const VILLKOR = `or=(jurform.not.in.(${OFFENTLIGA}),jurform.is.null,orgnr.not.like.2*,orgnr.is.null)`;
/** Registerkoder som vyn visar under en annan nischkod (hantverk-pafyllning-002.sql). */
const SAMMA_YRKE = { 16232: 16233 };
/** SNI 2025 → sajtens ng1. Samma tabell som scripts/importera-pafyllning.mjs. */
const SNI_TILL_NG1 = {
  41000: 41200, 42221: 42220, 42222: 42220, 43229: 43221, 43230: 43290, 43240: 43290,
  43411: 43911, 43412: 43912, 16250: 16233, 23660: 23690,
  43350: 43999, 43910: 43999, 43420: 43999, 43500: 43999,
};
const ng1For = (sni) => (sni ? SNI_TILL_NG1[sni] ?? Number(sni) : null);
const utanNolla = (k) => String(Number(k));
const siffror = (s) => String(s ?? "").replace(/\D/g, "");

// ---- REST --------------------------------------------------------------------

async function rest(path, init = {}, h = H_SR) {
  for (let forsok = 1; ; forsok++) {
    const res = await fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { ...h, ...(init.headers ?? {}) } });
    if (res.ok) return res.status === 204 ? null : res.json().catch(() => null);
    const text = await res.text();
    if (forsok < 4 && res.status >= 500) { await new Promise((r) => setTimeout(r, 1000 * forsok)); continue; }
    throw new Error(`${init.method ?? "GET"} ${path.slice(0, 80)}: ${res.status} ${text.slice(0, 300)}`);
  }
}
async function allaSidor(path, h) {
  const ut = [];
  for (let off = 0; ; off += 1000) {
    const bit = await rest(`${path}&offset=${off}&limit=1000`, {}, h);
    ut.push(...bit);
    if (bit.length < 1000) return ut;
  }
}

// ---- mtoz (READ ONLY) --------------------------------------------------------

function mtozUrl() {
  if (process.env.MTOZ_DATABASE_URL) return process.env.MTOZ_DATABASE_URL;
  const rad = readFileSync(`${homedir()}/Projects/foretagskoll/.env.local`, "utf8").split("\n").find((r) => r.startsWith("DATABASE_URL="));
  if (!rad) throw new Error("DATABASE_URL saknas i foretagskoll/.env.local");
  return rad.slice("DATABASE_URL=".length).replace(/^"|"$/g, "").trim();
}
const TMP = mkdtempSync(join(tmpdir(), "steg2-"));
chmodSync(TMP, 0o700);
process.on("exit", () => rmSync(TMP, { recursive: true, force: true }));

function parseCsv(text) {
  const rader = [];
  let rad = [], falt = "", iCitat = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (iCitat) {
      if (c === '"') { if (text[i + 1] === '"') { falt += '"'; i++; } else iCitat = false; } else falt += c;
    } else if (c === '"') iCitat = true;
    else if (c === ",") { rad.push(falt); falt = ""; }
    else if (c === "\n") { rad.push(falt); rader.push(rad); rad = []; falt = ""; }
    else if (c !== "\r") falt += c;
  }
  if (falt || rad.length) { rad.push(falt); rader.push(rad); }
  const [rubrik, ...resten] = rader;
  return resten.filter((r) => r.length === rubrik.length).map((r) => Object.fromEntries(rubrik.map((k, i) => [k, r[i] === "" ? null : r[i]])));
}

/** Kör en SELECT i mtoz. `listor` blir psql-variabler (textarrayer) ur filer. */
function mtoz(sql, listor = {}) {
  let set = "";
  for (const [namn, varden] of Object.entries(listor)) {
    const f = join(TMP, `${namn}.txt`);
    writeFileSync(f, `{${varden.join(",")}}`, { mode: 0o600 });
    set += `\\set ${namn} \`cat ${f}\`\n`;
  }
  const r = spawnSync("psql", [mtozUrl(), "-X", "-q", "-v", "ON_ERROR_STOP=1", "--csv", "-f", "-"], {
    input: `${set}begin transaction read only;\nset local statement_timeout = '900s';\n${sql};\nrollback;\n`,
    maxBuffer: 1024 * 1024 * 1024,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(r.stderr.split("\n").filter((l) => !/collation|HINT|DETAIL/.test(l)).join("\n"));
  return parseCsv(r.stdout);
}

// ---- 0. Körloggen och SCB-underlaget ------------------------------------------

const logg = korlogg({ rest, skript: "steg2", tvinga: TVINGA });
for (const h of ["uncaughtException", "unhandledRejection"]) {
  process.on(h, async (e) => {
    console.error(e);
    try { await logg.skriv({ status: "fel", klar: new Date().toISOString(), orsak: String(e?.message ?? e).slice(0, 500) }); } catch {}
    process.exit(1);
  });
}
const forra = await logg.fore();
const underlag = logg.scbSkal(mtoz(SCB_UNDERLAG_SQL)[0], forra);
console.error(`SCB-underlaget: ${underlag.verksamma} verksamma arbetsställen, läsning ${underlag.afrDatum}` +
  (forra ? ` (förra körningen ${forra.startad}: ${forra.scb_verksamma})` : " (ingen tidigare körning)"));
await logg.skriv({ status: TORR ? "torrkorning" : "pagar", afr_datum: underlag.afrDatum, scb_verksamma: underlag.verksamma });
if (TORR) { if (underlag.skal.length) console.error(`Nödbromsen skulle slå till:\n  - ${underlag.skal.join("\n  - ")}`); }
else await logg.stoppaOm(underlag.skal);

// ---- 1. Det köpta registrets rader på sajten ---------------------------------

console.error("Läser registrets rader på sajten …");
const koder = [...NISCH, ...Object.keys(SAMMA_YRKE).map(Number)];
const RADKOLUMNER = "cfarnr,orgnr,ng1,kommun,poang,jurform,ar_enskild_firma,firma,namn,postnr,gatuadress,tel,telefon";
const gamla = (await allaSidor(
  `foretag_publik?select=${RADKOLUMNER}&ng1=in.(${koder.join(",")})&${VILLKOR}&order=cfarnr`,
  H_ANON,
)).map((r) => ({ ...r, ng1: SAMMA_YRKE[r.ng1] ?? r.ng1, orgnr: siffror(r.orgnr) || null }));
console.error(`  ${gamla.length} rader`);

const overlay = await allaSidor("overlay_profil?select=external_id&sajt=eq.hantverkardelen&order=id", H_SR);
const overlayIds = new Set(overlay.map((o) => siffror(o.external_id)).filter(Boolean));
const arKund = (r) => (r.poang ?? 0) > 0 || overlayIds.has(String(r.cfarnr)) || (r.orgnr && overlayIds.has(r.orgnr));

// Organisationsnummer bakom dolda rader (foretag_dold). Bara organisationsnummerform.
const doldaOrgnr = new Set((await rest("hantverk_dolda_orgnr?select=orgnr")).map((r) => r.orgnr));
const doltBolag = (r) => !!r.orgnr && doldaOrgnr.has(r.orgnr);
console.error(`  dolda organisationsnummer: ${doldaOrgnr.size}`);

// ---- 1b. Registrets rader under en kod utanför sajten, med hantverkskod i SCB --

/** SNI 2025-koderna som blir ett av sajtens yrken (samma lista som påfyllningens urval). */
const HANTVERK_SNI = [...readFileSync(new URL("./sql/pafyllning-urval.sql", import.meta.url), "utf8")
  .match(/a\.sni_primar in \(([\s\S]*?)\)/)[1].matchAll(/'(\d{5})'/g)].map((m) => m[1])
  .filter((k) => NISCH_SET.has(ng1For(k)));

console.error("Söker registrets rader med hantverkskod i SCB men annan kod i registret …");
const gamlaCf = new Set(gamla.map((r) => r.cfarnr));
const hantverkJp = mtoz(
  `select a.cfarnr from arbetsstalle a
    where a.aestat = 1 and a.borta_ur_afr is null and not a.ar_fysisk_person
      and a.orgnr ~ '^[0-9]{2}[2-9][0-9]{7}$' and left(a.orgnr, 2) not in ('20','21','22','23')
      and a.sni_primar = any(:'sni'::text[])`,
  { sni: HANTVERK_SNI },
).map((r) => Number(r.cfarnr)).filter((c) => !gamlaCf.has(c));
const utanforRaw = [];
for (let i = 0; i < hantverkJp.length; i += 2400) {
  const bitar = [];
  for (let j = i; j < Math.min(i + 2400, hantverkJp.length); j += 300) bitar.push(hantverkJp.slice(j, j + 300));
  for (const b of await Promise.all(bitar.map((bit) =>
    rest(`foretag_publik?select=${RADKOLUMNER}&cfarnr=in.(${bit.join(",")})&${VILLKOR}`, {}, H_ANON)))) utanforRaw.push(...b);
}
const utanfor = utanforRaw
  .map((r) => ({ ...r, ng1: SAMMA_YRKE[r.ng1] ?? r.ng1, orgnr: siffror(r.orgnr) || null }))
  .filter((r) => !koder.includes(r.ng1));
// Juridiska personer nu; enskilda firmor kommer med omgång 2. Kunder rörs aldrig.
const tillkommer = utanfor.filter((r) => !r.ar_enskild_firma && r.jurform !== 10 && !arKund(r) && !doltBolag(r));
console.error(`  ${hantverkJp.length} verksamma juridiska personer med hantverkskod som inte står under sajtens yrken i registret;` +
  ` ${utanfor.length} av dem finns i registret under en annan kod, ${tillkommer.length} tillkommer` +
  ` (${utanfor.filter(arKund).length} kunder och ${utanfor.filter(doltBolag).length} dolda bolag rörs inte)`);

// ---- 2. Status och SCB:s uppgifter per cfarnr --------------------------------

console.error("Läser arbetsställena ur mtoz (read only) …");
const allaCf = [...gamla, ...tillkommer].map((r) => r.cfarnr);
const scb = new Map();
for (const r of mtoz(
  `with karta as (
     select besok_postnr pn, min(kommun) kommun from arbetsstalle
      where kommun <> '0000' and besok_postnr ~ '^[0-9]{5}$' group by 1 having count(distinct kommun) = 1)
   select a.cfarnr, a.aestat, (a.borta_ur_afr is not null) as borta, a.ar_fysisk_person as fp, a.orgnr,
     coalesce(nullif(trim(f.namn),''), nullif(trim(fk.namn),''), nullif(trim(a.benamning),'')) as namn,
     coalesce(nullif(trim(a.besok_gatuadress),''), nullif(trim(a.post_gatuadress),'')) as gatuadress,
     case when a.besok_postnr ~ '^[0-9]{5}$' and a.besok_postnr <> '00000' then a.besok_postnr
          when a.post_postnr ~ '^[0-9]{5}$' and a.post_postnr <> '00000' then a.post_postnr end as postnr,
     coalesce(nullif(trim(a.besok_postort),''), nullif(trim(a.post_postort),'')) as postort,
     case when a.kommun <> '0000' then a.kommun else k.kommun end as kommun,
     a.sni_primar as sni, a.anstkl,
     (select string_agg(s.sni, ',' order by s.rang) from arbetsstalle_sni s where s.cfarnr = a.cfarnr) as alla_sni,
     (select max(afr_datum) from arbetsstalle_lasning) as afr_datum
   from arbetsstalle a
   left join foretag f on f.orgnr = a.orgnr and not a.ar_fysisk_person
   left join fk_companies fk on fk.orgnr = a.orgnr and not a.ar_fysisk_person
   left join karta k on k.pn = case when a.besok_postnr ~ '^[0-9]{5}$' and a.besok_postnr <> '00000' then a.besok_postnr
                                    when a.post_postnr ~ '^[0-9]{5}$' and a.post_postnr <> '00000' then a.post_postnr end
   where a.cfarnr = any(:'cf'::bigint[])`,
  { cf: allaCf },
)) scb.set(Number(r.cfarnr), r);
const verksam = (r) => { const a = scb.get(r.cfarnr); return !!a && a.aestat === "1" && a.borta !== "t"; };
/**
 * Arbetsställets hantverkskod i SCB: huvudkoden om den är ett av sajtens
 * yrken, annars den första bikoden (i SCB:s rangordning) som är det.
 */
function hantverkskod(cfarnr) {
  const a = scb.get(cfarnr);
  if (!a) return null;
  const alla = [a.sni, ...(a.alla_sni ? a.alla_sni.split(",") : [])].filter(Boolean);
  for (const k of alla) {
    const ng1 = ng1For(k);
    if (NISCH_SET.has(ng1)) return { ng1, kod: k, huvudkod: k === a.sni };
  }
  return null;
}
const visas = (r) => verksam(r) && !!hantverkskod(r.cfarnr) && !doltBolag(r);
const AFR_DATUM = [...scb.values()].find((a) => a.afr_datum)?.afr_datum ?? null;
console.error(`  ${scb.size} hittade i SCB:s register, SCB-datum ${AFR_DATUM}`);

// ---- 3. Vad som finns på sajten efter steg två -------------------------------

console.error("Läser påfyllningen …");
const paf = await allaSidor("hantverk_pafyllning?select=cfarnr,orgnr,kommun,ng1&order=cfarnr", H_SR);
const dolda = new Set((await rest("foretag_dold?select=cfarnr")).map((r) => Number(r.cfarnr)));
const paSajten = new Map(); // cfarnr -> { kommun }
for (const p of paf) {
  if (dolda.has(p.cfarnr) || gamlaCf.has(p.cfarnr) || doldaOrgnr.has(siffror(p.orgnr))) continue;
  paSajten.set(p.cfarnr, { kommun: p.kommun });
}
for (const r of gamla) if (arKund(r) || visas(r)) paSajten.set(r.cfarnr, { kommun: r.kommun });
for (const r of tillkommer) if (visas(r) && hantverkskod(r.cfarnr).huvudkod) paSajten.set(r.cfarnr, { kommun: r.kommun });

// ---- 4. Spårkontroll för rader som inte är verksamma -------------------------

const saknas = gamla.filter((r) => !arKund(r) && !verksam(r));
console.error(`Spårkontroll för ${saknas.length} rader …`);

// 4a. Samma orgnr: bolagets verksamma arbetsställen.
const jpOrgnr = [...new Set(saknas.map((r) => r.orgnr).filter((o) => o && /^\d{2}[2-9]\d{7}$/.test(o)))];
const perOrgnr = new Map();
for (const a of mtoz(
  `select cfarnr, orgnr, kommun from arbetsstalle
    where aestat = 1 and borta_ur_afr is null and not ar_fysisk_person and orgnr = any(:'org'::text[])`,
  { org: jpOrgnr },
)) (perOrgnr.get(a.orgnr) ?? perOrgnr.set(a.orgnr, []).get(a.orgnr)).push(a);

// 4b. Namn i samma postnummer (samma regel som steg2-plan/spar.py).
const JURIDISKT = new Set("ab aktiebolag hb kb handelsbolag kommanditbolag ek för enskild firma ef i och the of &".split(" "));
const ALLMANT = new Set(`region syd norr nord sydost nordost vast väst ost öst mitt mellan sverige sweden svenska svensk nordic nordiska
skandinavien scandinavia europa international bygg byggnad byggare bygger byggservice byggteknik byggtjänst byggnads service
services entreprenad entreprenör entreprenörer el elektriska elektro elteknik elservice elinstallation elinstallationer vvs rör
rörläggeri rörmokeri måleri målare målning snickeri snickare snickerier golv golvläggning kakel tak takläggning plåt plåtslageri
mark markarbeten anläggning schakt montage installation installationer teknik tekniska fastighet fastigheter förvaltning konsult
konsulter holding invest group gruppen partner partners produktion design hus hem home tjänst tjänster ventilation kyl kyla värme
trädgård trädgårdar transport transporter maskin maskiner renovering reparation städ handel handelsbolaget och co company
kommun stad län sydsverige norrland götaland svealand stockholm göteborg malmö`.split(/\s+/));
const ordAv = (s) => (s ?? "").toLowerCase().replace(/&/g, " och ").replace(/[^a-zåäöéü0-9 ]/g, " ").split(/\s+/).filter((w) => w && !JURIDISKT.has(w));
const egna = (t) => t.filter((w) => !ALLMANT.has(w) && w.length >= 3 && !/^\d+$/.test(w));
function namnlika(a, b) {
  if (!a.length || !b.length || !egna(a).length || !egna(b).length) return false;
  if (a.join(" ") === b.join(" ")) return true;
  const [kort, lang] = a.length <= b.length ? [a, b] : [b, a];
  const L = new Set(lang);
  if (kort.length < 2 || !kort.every((w) => L.has(w))) return false;
  return kort.length / lang.length >= 0.6;
}
const postnrLista = [...new Set(saknas.map((r) => siffror(r.postnr)).filter((p) => p.length === 5))];
const perPostnr = new Map();
for (const a of mtoz(
  `select a.cfarnr, a.orgnr, a.kommun, a.benamning, coalesce(f.namn,'') fnamn, coalesce(ff.namn,'') ffnamn,
          a.besok_postnr, a.post_postnr, a.besok_gatuadress, a.post_gatuadress
     from arbetsstalle a
     left join foretag f on f.orgnr = a.orgnr
     left join fk_firmor ff on ff.cfarnr = a.cfarnr
    where a.aestat = 1 and a.borta_ur_afr is null
      and (a.besok_postnr = any(:'pn'::text[]) or a.post_postnr = any(:'pn'::text[]))`,
  { pn: postnrLista },
)) {
  a.ord = [ordAv(a.benamning), ordAv(a.fnamn), ordAv(a.ffnamn)];
  for (const pn of new Set([a.besok_postnr, a.post_postnr])) if (pn) (perPostnr.get(pn) ?? perPostnr.set(pn, []).get(pn)).push(a);
}

// 4c. Telefon: samma nummer hos ett verksamt arbetsställe (högst tre bolag per nummer).
const normTel = (t) => { let s = siffror(t); if (s.startsWith("46")) s = "0" + s.slice(2); return s.length >= 7 ? s : null; };
const telLista = [...new Set(saknas.flatMap((r) => [normTel(r.tel), normTel(r.telefon)]).filter(Boolean))];
const perTel = new Map();
for (const a of mtoz(
  `with x as (
     select f.orgnr, null::bigint cf, regexp_replace(regexp_replace(f.telefon,'\\D','','g'),'^46','0') t from foretag f where f.telefon is not null
     union all
     select null, ff.cfarnr, regexp_replace(regexp_replace(ff.telefon,'\\D','','g'),'^46','0') from fk_firmor ff where ff.telefon is not null)
   select x.t, a.cfarnr, a.orgnr, a.kommun from x
     join arbetsstalle a on (a.orgnr = x.orgnr or a.cfarnr = x.cf) and a.aestat = 1 and a.borta_ur_afr is null
    where x.t = any(:'tl'::text[])`,
  { tl: telLista },
)) (perTel.get(a.t) ?? perTel.set(a.t, []).get(a.t)).push(a);

/** Bästa målet på sajten: samma kommun först, sedan lägsta cfarnr. */
function valjMal(rad, kandidater) {
  const pa = kandidater.map((a) => Number(a.cfarnr)).filter((cf) => cf !== rad.cfarnr && paSajten.has(cf));
  if (!pa.length) return null;
  const k = String(rad.kommun ?? "");
  const sammaKommun = pa.filter((cf) => String(paSajten.get(cf).kommun ?? "") === k);
  return (sammaKommun.length ? sammaKommun : pa).sort((x, y) => x - y)[0];
}
const gata = (s) => (s ?? "").toLowerCase().replace(/[^a-zåäö0-9]/g, "");

function spar(r) {
  if (r.orgnr && perOrgnr.has(r.orgnr)) {
    const mal = valjMal(r, perOrgnr.get(r.orgnr));
    if (mal) return { via: "orgnr", mal };
  }
  const pn = siffror(r.postnr);
  const kand = perPostnr.get(pn) ?? [];
  const n = ordAv(r.firma || r.namn);
  const traffar = kand.filter((a) => a.ord.some((m) => namnlika(n, m)));
  if (traffar.length) {
    const mal = valjMal(r, traffar);
    if (mal) return { via: "namn", mal };
  }
  for (const t of [normTel(r.tel), normTel(r.telefon)]) {
    const ts = t && perTel.get(t);
    if (ts && new Set(ts.map((x) => x.orgnr || x.cfarnr)).size <= 3) {
      const mal = valjMal(r, ts);
      if (mal) return { via: "telefon", mal };
    }
  }
  if (traffar.length || (r.orgnr && perOrgnr.has(r.orgnr))) return { via: "efterfoljare_ej_pa_sajten", mal: null };
  const g = gata(r.gatuadress);
  if (g && kand.some((a) => g === gata(a.besok_gatuadress) || g === gata(a.post_gatuadress))) return { via: "adress", mal: null };
  return { via: "inget", mal: null };
}

// ---- 5. Tabellens rader --------------------------------------------------------

/** En rad som visas, med SCB:s uppgifter. */
function visasRad(r, via) {
  const a = scb.get(r.cfarnr);
  const kommun = a.kommun && a.kommun !== "0000" ? utanNolla(a.kommun) : null;
  return {
    cfarnr: r.cfarnr, kommun_register: r.kommun != null ? String(r.kommun) : null, ng1_register: r.ng1,
    utfall: "visas", via, mal_cfarnr: null,
    // Enskilda firmor behåller registrets namn: SCB:s benämning kan vara ägarens namn.
    firma: r.ar_enskild_firma || a.fp === "t" ? null : a.namn,
    gatuadress: a.gatuadress, postnr: a.postnr ? Number(a.postnr) : null, postort: a.postort,
    kommun, lan: kommun ? utanNolla(a.kommun.slice(0, 2)) : null,
    // SCB styr branschen: huvudkoden först, annars första bikoden som är ett av sajtens yrken.
    ng1: hantverkskod(r.cfarnr).ng1,
    bikod: !hantverkskod(r.cfarnr).huvudkod,
    storleksklass: a.anstkl && Number(a.anstkl) > 0 ? Number(a.anstkl) : null,
    afr_datum: a.afr_datum,
  };
}
const dold = (r, via, mal = null) => ({
  cfarnr: r.cfarnr, kommun_register: r.kommun != null ? String(r.kommun) : null, ng1_register: r.ng1,
  utfall: mal ? "308" : "404", via, mal_cfarnr: mal,
  firma: null, gatuadress: null, postnr: null, postort: null, kommun: null, lan: null, ng1: null, storleksklass: null, afr_datum: null,
  bikod: false,
});

const rader = [];
for (const r of gamla) {
  if (arKund(r)) continue;
  if (doltBolag(r)) rader.push(dold(r, "dolt_bolag"));
  else if (verksam(r)) rader.push(hantverkskod(r.cfarnr) ? visasRad(r, "scb_verksam") : dold(r, "scb_ej_hantverk"));
  else { const s = spar(r); rader.push(dold(r, s.via, s.mal)); }
}
// Tillkommande rader kräver hantverk som SCB:s huvudkod (urvalet ovan); en bikod räcker inte.
for (const r of tillkommer) if (visas(r) && hantverkskod(r.cfarnr).huvudkod) rader.push(visasRad(r, "scb_hantverkskod"));

// ---- 6. Rapport -----------------------------------------------------------------

const rakna = (lista, f) => lista.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {});
const kunder = gamla.filter(arKund);
// Verksamma rader vars huvudkod i SCB inte är ett av sajtens yrken (förra versionens 3 028).
const annanHuvudkod = gamla.filter((r) => !arKund(r) && verksam(r) && !NISCH_SET.has(ng1For(scb.get(r.cfarnr).sni)));
const toppKoder = (lista) => Object.entries(rakna(lista, (r) => scb.get(r.cfarnr).sni ?? "saknas"))
  .sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k}: ${n}`);
const RAPPORT = {
  registerrader: gamla.length,
  kunder: kunder.length,
  kunder_saknas_i_scb: kunder.filter((r) => !verksam(r)).length,
  utfall: rakna(rader, (r) => r.utfall),
  via: rakna(rader, (r) => `${r.utfall} ${r.via}`),
  visas_av_registrets_rader: rader.filter((r) => r.utfall === "visas" && r.via === "scb_verksam").length,
  visas_byter_yrke: rader.filter((r) => r.utfall === "visas" && r.via === "scb_verksam" && r.ng1 !== r.ng1_register).length,
  visas_byter_kommun: rader.filter((r) => r.utfall === "visas" && r.via === "scb_verksam" && r.kommun && r.kommun !== r.kommun_register).length,
  visas_via_bikod: rader.filter((r) => r.utfall === "visas" && !hantverkskod(r.cfarnr).huvudkod).length,
  huvudkod_utanfor_sajten: {
    totalt: annanHuvudkod.length,
    hantverkskod_som_bikod_visas: annanHuvudkod.filter((r) => hantverkskod(r.cfarnr)).length,
    varav_samma_yrke_som_registret: annanHuvudkod.filter((r) => hantverkskod(r.cfarnr)?.ng1 === r.ng1).length,
    ingen_hantverkskod_404: annanHuvudkod.filter((r) => !hantverkskod(r.cfarnr)).length,
    vanligaste_huvudkoder_bland_404: toppKoder(annanHuvudkod.filter((r) => !hantverkskod(r.cfarnr))),
  },
  tillkommer_fran_annan_kod_i_registret: {
    i_registret_under_annan_kod: utanfor.length,
    enskilda_firmor_vantar_omgang2: utanfor.filter((r) => r.ar_enskild_firma || r.jurform === 10).length,
    kunder_rors_inte: utanfor.filter(arKund).length,
    tillkommer: rader.filter((r) => r.via === "scb_hantverkskod").length,
    varav_via_bikod: rader.filter((r) => r.via === "scb_hantverkskod" && !hantverkskod(r.cfarnr).huvudkod).length,
    per_yrke: rakna(rader.filter((r) => r.via === "scb_hantverkskod"), (r) => r.ng1),
  },
};
console.error(JSON.stringify(RAPPORT, null, 2));
if (process.env.STEG2_RAPPORT) writeFileSync(process.env.STEG2_RAPPORT, JSON.stringify(RAPPORT, null, 2));

// ---- 6b. Nödbromsen: hur många visade rader döljs? -----------------------------

const forraTabell = await allaSidor("hantverk_steg2?select=cfarnr,utfall&order=cfarnr", H_SR);
const visadesFore = new Set(forraTabell.filter((r) => r.utfall === "visas").map((r) => r.cfarnr));
const visasEfter = new Set(rader.filter((r) => r.utfall === "visas").map((r) => r.cfarnr));
for (const r of kunder) { visasEfter.add(r.cfarnr); if (forraTabell.length) visadesFore.add(r.cfarnr); }
const doljs = [...visadesFore].filter((c) => !visasEfter.has(c)).length;
console.error(`Visades efter förra körningen: ${visadesFore.size}, visas efter den här: ${visasEfter.size}, döljs: ${doljs}`);
const falt = { visade_fore: visadesFore.size, visade_efter: visasEfter.size, doljs };
if (TORR) {
  const skal = logg.doljsSkal(visadesFore.size, doljs);
  if (skal.length) console.error(`Nödbromsen skulle slå till:\n  - ${skal.join("\n  - ")}`);
  await logg.skriv({ ...falt, klar: new Date().toISOString() });
  console.error("Torrkörning: inget skrivet.");
  process.exit(0);
}
await logg.stoppaOm(logg.doljsSkal(visadesFore.size, doljs), falt);

// ---- 7. Skriv tabellen, bygg om vyn ----------------------------------------------

console.error(`Skriver ${rader.length} rader till hantverk_steg2 …`);
const kord_at = new Date().toISOString();
for (let i = 0; i < rader.length; i += 500) {
  await rest("hantverk_steg2?on_conflict=cfarnr", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rader.slice(i, i + 500).map((r) => ({ ...r, kord_at }))),
  });
}
// Rader som inte kom med i den här körningen (blev kund, försvann ur registret
// eller ur sajtens yrken) tas bort: de ska inte ligga kvar som dolda.
const nu = new Set(rader.map((r) => r.cfarnr));
const fanns = (await allaSidor("hantverk_steg2?select=cfarnr&order=cfarnr", H_SR)).map((r) => r.cfarnr);
const bort = fanns.filter((c) => !nu.has(c));
for (let i = 0; i < bort.length; i += 300) {
  await rest(`hantverk_steg2?cfarnr=in.(${bort.slice(i, i + 300).join(",")})`, { method: "DELETE" });
}
console.error(`  borttagna ur tabellen: ${bort.length}`);

console.error("Bygger om hantverk_foretag_steg2 och antalen (hantverk_steg2_bygg_om) …");
const ombyggd = await rest("rpc/hantverk_steg2_bygg_om", {
  method: "POST",
  body: JSON.stringify({ p_offentliga: OFFENTLIGA.split(",").map(Number) }),
});
console.error(`  ${JSON.stringify(ombyggd)}`);

// ---- 8. Antalen för hubbarna -----------------------------------------------------
// Sajten läser antalen ur hantverk_antal (src/lib/antal.ts). Filen nedan är
// reserven om databasen inte svarar, och följer med vid nästa deploy.

const antal = await allaSidor("hantverk_antal?select=kommun,ng1,n&order=kommun,ng1", H_SR);
const kf = {}, kbf = {};
let total = 0;
for (const { kommun, ng1, n } of antal) {
  total += n;
  kf[kommun] = (kf[kommun] ?? 0) + n;
  (kbf[kommun] ??= {})[ng1] = n;
}
const datum = new Date().toISOString().slice(0, 10);
writeFileSync(
  new URL("../src/lib/seo-snapshot-steg2.ts", import.meta.url),
  `/**
 * GENERERAD FIL — redigera inte för hand.
 *
 * Antal företag per kommun och per kommun × yrke i hantverk_foretag_steg2
 * (steg två: det köpta registrets verksamma rader, kunderna och påfyllningen).
 * Ersätter seo-snapshot.ts + seo-snapshot-pafyllning.ts när flaggan STEG2 är på
 * (lib/seo.ts, lib/pafyllning-antal.ts). Rader utan kommun räknas inte.
 *
 * Skapad av scripts/steg2-upphorda.mjs.
 */

export const STEG2_GENERERAD = "${datum}";

/** SCB-datumet för uppgifterna (max afr_datum i mtoz). */
export const STEG2_SCB_DATUM = ${JSON.stringify(AFR_DATUM)};

export const STEG2_TOTAL = ${total};

export const KOMMUN_FORETAG_STEG2: Readonly<Record<string, number>> = ${JSON.stringify(kf, null, 2)};

export const KOMMUN_BRANSCH_FORETAG_STEG2: Readonly<Record<string, Readonly<Record<string, number>>>> = ${JSON.stringify(kbf, null, 2)};
`,
);
console.error("Skrev src/lib/seo-snapshot-steg2.ts");

// ---- 9. Bygg om sidorna -------------------------------------------------------------

if (REVALIDERA) {
  const secret = process.env.OVERLAY_PUBLISH_SECRET;
  const raw = JSON.stringify({ action: "steg2_revalidera", sent_at: new Date().toISOString() });
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  const extra = process.env.VERCEL_OIDC_TOKEN ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN } : {};
  const res = await fetch(`${REVALIDERA.replace(/\/$/, "")}/api/steg2/revalidera`, {
    method: "POST", body: raw, headers: { "content-type": "application/json", "x-overlay-signature": sig, ...extra },
  });
  console.error(`Revalidering: ${res.status} ${await res.text()}`);
  if (!res.ok) throw new Error(`revalideringen av ${REVALIDERA} svarade ${res.status}; tabellen och vyn är skrivna, sidorna är inte ombyggda`);
}

await logg.skriv({ status: "klar", klar: new Date().toISOString(), ...falt });
console.error("Klart. Körningen är loggad i hantverk_korning.");
