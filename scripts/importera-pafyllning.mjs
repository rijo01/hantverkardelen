// Påfyllningen: kopierar aktiva hantverksföretag ur Infofinder (mtoz) som inte
// finns i det gamla registret till hantverk_pafyllning i klusterdatabasen.
//
// Kör:
//   node --env-file=.env.local scripts/importera-pafyllning.mjs --omgang 1 [--torrkorning]
//
// Kräver MTOZ_DATABASE_URL (eller ~/Projects/foretagskoll/.env.local:s
// DATABASE_URL) och psql för läsningen, samt NEXT_PUBLIC_SUPABASE_URL och
// SUPABASE_SERVICE_ROLE_KEY för skrivningen.
//
// Regler (beslut 2026-11-23):
//  - mtoz läses bara, i en READ ONLY-transaktion (scripts/sql/pafyllning-urval.sql).
//  - aesamtable och foretag_publik läses bara. Skrivs gör bara hantverk_pafyllning.
//  - Ett cfarnr som finns i aesamtable (oavsett bransch) tas inte med. Ett
//    orgnr som finns bland sajtens juridiska personer tas inte med, inte heller
//    när det gäller en annan kommun (de tveksamma väntar till en senare omgång).
//  - Omgång 1: bara juridiska personer. Inga telefonnummer, personnummer
//    eller personnamn. E-post lagras (bara funktionsadresser) men visas inte.
//  - Skriptet är idempotent: rader som inte längre uppfyller villkoren tas bort
//    ur tabellen, så det kan köras dagligen efter SCB-körningen.
//
// Skriver också src/lib/seo-snapshot-pafyllning.ts (tillskottet till hubbarnas antal).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i < 0 ? null : process.argv[i + 1];
};
const TORR = process.argv.includes("--torrkorning");
const OMGANG = Number(arg("--omgang"));
if (OMGANG !== 1) {
  console.error("Bara --omgang 1 finns (juridiska personer). Omgång 2 (enskilda firmor) byggs senare.");
  process.exit(1);
}

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NYCKEL = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !NYCKEL) {
  console.error("NEXT_PUBLIC_SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY krävs (--env-file=.env.local).");
  process.exit(1);
}
const H = { apikey: NYCKEL, Authorization: `Bearer ${NYCKEL}`, "Content-Type": "application/json" };

function mtozUrl() {
  if (process.env.MTOZ_DATABASE_URL) return process.env.MTOZ_DATABASE_URL;
  const f = `${homedir()}/Projects/foretagskoll/.env.local`;
  if (!existsSync(f)) throw new Error("MTOZ_DATABASE_URL saknas");
  const rad = readFileSync(f, "utf8").split("\n").find((r) => r.startsWith("DATABASE_URL="));
  if (!rad) throw new Error("DATABASE_URL saknas i foretagskoll/.env.local");
  return rad.slice("DATABASE_URL=".length).replace(/^"|"$/g, "").trim();
}

// ---- Sajtens yrkeskoder ------------------------------------------------------

const src = (rel) => readFileSync(new URL(`../src/lib/${rel}`, import.meta.url), "utf8");
const NISCH = [];
{
  const m = src("hantverk-branscher.ts").match(/export const HANTVERK_BRANSCHER[^=]*=\s*\[([\s\S]*?)\];/);
  for (const line of m[1].split("\n")) {
    const k = line.replace(/\/\/.*$/, "").trim().match(/^(\d+)\s*,?$/);
    if (k) NISCH.push(Number(k[1]));
  }
}
/**
 * Gamla registerkoder som vyn hantverk_foretag_publik visar under en annan
 * nischkod (lib/sql/hantverk-pafyllning-002.sql). De hör till nischen när
 * påfyllningen jämför orgnr och räknar hubbarnas antal.
 */
const SAMMA_YRKE = { 16232: 16233 };
const NISCH_MED_SAMMA_YRKE = [...NISCH, ...Object.keys(SAMMA_YRKE).map(Number)];

/** SNI 2025 → sajtens ng1 (SNI 2007). Riktningen är ny kod → dagens yrke. */
const SNI_TILL_NG1 = {
  41000: 41200,
  42221: 42220, 42222: 42220,
  43229: 43221,
  43230: 43290, 43240: 43290,
  43411: 43911, 43412: 43912,
  16250: 16233,
  23660: 23690,
  43350: 43999, 43910: 43999, 43420: 43999, 43500: 43999,
};
const ng1For = (sni) => SNI_TILL_NG1[sni] ?? Number(sni);

/** Juridisk form (text i mtoz) → SCB:s kod, som sajten och aesamtable använder. */
const JURFORM = {
  "aktiebolag": 49, "övriga aktiebolag": 49,
  "handelsbolag, kommanditbolag": 31, "handelsbolag": 31, "kommanditbolag": 31,
  "enkla bolag": 21,
  "ekonomiska föreningar": 51, "ekonomisk förening": 51,
  "bostadsrättsföreningar": 53, "bostadsrättsförening": 53,
  "ideella föreningar": 61, "samfälligheter": 62,
  "övriga stiftelser och fonder": 72,
  "oskiftade dödsbon": 91,
  "utländska juridiska personer": 96, "filial": 96,
};

/** Kataloger och sociala medier är inte företagets egen hemsida. */
const INTE_EGEN_DOMAN =
  /(^|\.)(hitta|eniro|allabolag|ratsit|merinfo|proff|bolagsfakta|foretagsfakta|facebook|instagram|linkedin|google|blocket|reco|byggfakta|mitti|gulasidorna|118100|upplysning|bisnode)\.[a-z]+$/i;

function egenHemsida(url) {
  if (!url) return null;
  const s = url.trim();
  let host;
  try {
    host = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host.includes(".") || INTE_EGEN_DOMAN.test(host)) return null;
  return s;
}

/** "0180" → "180", som aesamtable skriver kommun- och länskoder. */
const utanNolla = (k) => String(Number(k));

// ---- CSV ---------------------------------------------------------------------

function parseCsv(text) {
  const rader = [];
  let rad = [], falt = "", iCitat = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (iCitat) {
      if (c === '"') {
        if (text[i + 1] === '"') { falt += '"'; i++; } else iCitat = false;
      } else falt += c;
    } else if (c === '"') iCitat = true;
    else if (c === ",") { rad.push(falt); falt = ""; }
    else if (c === "\n") { rad.push(falt); rader.push(rad); rad = []; falt = ""; }
    else if (c !== "\r") falt += c;
  }
  if (falt || rad.length) { rad.push(falt); rader.push(rad); }
  const [rubrik, ...resten] = rader;
  return resten.map((r) => Object.fromEntries(rubrik.map((k, i) => [k, r[i] === "" ? null : r[i]])));
}

// ---- Supabase REST -----------------------------------------------------------

// foretag_publik är bara utlämnad till anon (som sajten läser den), inte till service_role.
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H_ANON = { apikey: ANON, Authorization: `Bearer ${ANON}` };

async function rest(path, init = {}, rubriker = H) {
  for (let forsok = 1; ; forsok++) {
    const res = await fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { ...rubriker, ...(init.headers ?? {}) } });
    if (res.ok) return res.status === 204 ? null : res.json().catch(() => null);
    const text = await res.text();
    if (forsok < 4 && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000 * forsok));
      continue;
    }
    throw new Error(`${init.method ?? "GET"} ${path.slice(0, 80)}: ${res.status} ${text.slice(0, 300)}`);
  }
}

async function iBitar(lista, storlek, fn) {
  const ut = [];
  for (let i = 0; i < lista.length; i += storlek) ut.push(...((await fn(lista.slice(i, i + storlek))) ?? []));
  return ut;
}

// ---- 1. Läs kandidaterna ur mtoz --------------------------------------------

console.error("Läser kandidater ur mtoz (read only) …");
const sql = readFileSync(new URL("./sql/pafyllning-urval.sql", import.meta.url), "utf8");
const psql = spawnSync(
  "psql",
  [mtozUrl(), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"],
  {
    input: `begin transaction read only;\nset local statement_timeout = '600s';\n${sql}\nrollback;\n`,
    maxBuffer: 1024 * 1024 * 512,
    encoding: "utf8",
  },
);
if (psql.status !== 0) {
  console.error(psql.stderr);
  process.exit(1);
}
const kandidater = parseCsv(psql.stdout);
console.error(`  ${kandidater.length} kandidater`);

// ---- 2. Uteslut det som redan finns i det gamla registret -------------------

console.error("Jämför med det gamla registret (cfarnr och orgnr) …");
const cfarnrIRegistret = new Set(
  (
    await iBitar(kandidater.map((k) => k.cfarnr), 300, (bit) =>
      rest(`aesamtable?select=cfarnr&cfarnr=in.(${bit.join(",")})`),
    )
  ).map((r) => String(r.cfarnr)),
);
const medOrgnr = (o) => `${o.slice(0, 6)}-${o.slice(6)}`;
const orgnrPaSajten = new Set(
  (
    await iBitar([...new Set(kandidater.map((k) => medOrgnr(k.orgnr)))], 150, (bit) =>
      rest(`foretag_publik?select=orgnr&ng1=in.(${NISCH_MED_SAMMA_YRKE.join(",")})&orgnr=in.(${bit.map((o) => `"${o}"`).join(",")})`, {}, H_ANON),
    )
  ).map((r) => r.orgnr),
);

/** SCB:s spärrkod som heltal, eller null om den saknas eller är okänd. */
const sparrkod = (v, giltiga) => (giltiga.includes(Number(v)) ? Number(v) : null);

const skal = { cfarnr_i_registret: 0, orgnr_pa_sajten: 0, utanfor_nischen: 0 };
const rader = [];
for (const k of kandidater) {
  if (cfarnrIRegistret.has(k.cfarnr)) { skal.cfarnr_i_registret++; continue; }
  const orgnr = medOrgnr(k.orgnr);
  if (orgnrPaSajten.has(orgnr)) { skal.orgnr_pa_sajten++; continue; }
  const ng1 = ng1For(k.sni2025);
  if (!NISCH.includes(ng1)) { skal.utanfor_nischen++; continue; }
  const kommun = k.kommun && k.kommun !== "0000" ? utanNolla(k.kommun) : null;
  const epost = k.epost?.trim() || null;
  rader.push({
    cfarnr: Number(k.cfarnr),
    firma: k.namn.trim(),
    gatuadress: k.gatuadress,
    postnr: k.postnr ? Number(k.postnr) : null,
    postort: k.postort,
    kommun,
    lan: kommun ? utanNolla(k.kommun.slice(0, 2)) : null,
    kommun_harledd: kommun != null && k.kommun_harledd === "t",
    sni2025: k.sni2025,
    ng1,
    jurform: JURFORM[(k.juridisk_form ?? "").toLowerCase()] ?? null,
    orgnr,
    ar_enskild_firma: false,
    aeant: Number(k.aeant ?? 1),
    storleksklass: k.storleksklass ? Number(k.storleksklass) : null,
    webb: egenHemsida(k.hemsida),
    epost,
    epost_kalla: epost ? k.epost_kalla : null,
    verksamhet: k.verksamhet,
    reklamsparr: k.reklamsparr === "2",
    // SCB:s spärrkoder som de står (lib/sql/hantverk-pafyllning-003.sql).
    reklam_sparr_typ: sparrkod(k.reklamsparr, [1, 2]),
    epost_sparr_typ: sparrkod(k.epostsparr, [1, 2]),
    telefon_sparr_typ: sparrkod(k.telefonsparr, [1, 2, 3]),
    omgang: OMGANG,
    kalla: "infofinder",
    afr_datum: k.afr_datum,
  });
}

// ---- 3. Rapport --------------------------------------------------------------

const rakna = (f) => rader.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {});
const rapport = {
  kandidater: kandidater.length,
  uteslutna: skal,
  tillkommer: rader.length,
  utan_kommun: rader.filter((r) => !r.kommun).length,
  kommun_harledd: rader.filter((r) => r.kommun_harledd).length,
  med_hemsida: rader.filter((r) => r.webb).length,
  med_funktionsepost: rader.filter((r) => r.epost).length,
  med_verksamhet: rader.filter((r) => r.verksamhet).length,
  reklamsparr: rader.filter((r) => r.reklamsparr).length,
  telefonsparr: rakna((r) => r.telefon_sparr_typ ?? "saknas"),
  epostsparr: rakna((r) => r.epost_sparr_typ ?? "saknas"),
  reklamsparr_typ: rakna((r) => r.reklam_sparr_typ ?? "saknas"),
  jurform_okand: rader.filter((r) => r.jurform == null).length,
  per_ng1: rakna((r) => r.ng1),
};
console.error(JSON.stringify(rapport, null, 2));

// ---- 4. Tillskottet till hubbarnas antal ------------------------------------

const dolda = new Set((await rest("foretag_dold?select=cfarnr")).map((r) => String(r.cfarnr)));
const kf = {}, kbf = {};
let total = 0;
for (const r of rader) {
  if (!r.kommun || dolda.has(String(r.cfarnr))) continue;
  total++;
  kf[r.kommun] = (kf[r.kommun] ?? 0) + 1;
  (kbf[r.kommun] ??= {})[r.ng1] = (kbf[r.kommun][r.ng1] ?? 0) + 1;
}
// Gamla rader som vyn flyttar till en nischkod (16232 -> 16233) finns inte i
// seo-snapshot.ts, eftersom deras kod inte är nischens. De räknas här.
let flyttade = 0;
for (const [fran, till] of Object.entries(SAMMA_YRKE)) {
  const gamla = await rest(`foretag_publik?select=cfarnr,kommun&ng1=eq.${fran}`, {}, H_ANON);
  for (const g of gamla) {
    if (g.kommun == null || dolda.has(String(g.cfarnr))) continue;
    const k = String(g.kommun);
    flyttade++;
    kf[k] = (kf[k] ?? 0) + 1;
    (kbf[k] ??= {})[till] = (kbf[k][till] ?? 0) + 1;
  }
}
console.error(`  gamla rader under annan nischkod (räknade i hubbarna): ${flyttade}`);
const sortera = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const datum = new Date().toISOString().slice(0, 10);
const snapshot = `/**
 * GENERERAD FIL — redigera inte för hand.
 *
 * Påfyllningens tillskott till seo-snapshot.ts: antal NYA rader (vyn
 * hantverk_foretag_publik minus foretag_publik) per kommun och per kommun ×
 * bransch. Läggs till ögonblicksbilden bara när flaggan PAFYLLNING är på
 * (lib/seo.ts). Rader utan kommun räknas inte. Hit räknas också gamla
 * registerrader som vyn visar under en nischkod (16232 som 16233); de ingår
 * inte i PAFYLLNING_TOTAL.
 *
 * Skapad av scripts/importera-pafyllning.mjs.
 */

export const PAFYLLNING_GENERERAD = "${datum}";

export const PAFYLLNING_TOTAL = ${total};

export const KOMMUN_FORETAG_NYA: Readonly<Record<string, number>> = ${JSON.stringify(sortera(kf), null, 2)};

export const KOMMUN_BRANSCH_FORETAG_NYA: Readonly<Record<string, Readonly<Record<string, number>>>> = ${JSON.stringify(
  Object.fromEntries(Object.keys(kbf).sort().map((k) => [k, sortera(kbf[k])])),
  null,
  2,
)};
`;

if (TORR) {
  console.error("Torrkörning: inget skrivet.");
  process.exit(0);
}

// ---- 5. Skriv ----------------------------------------------------------------

console.error(`Skriver ${rader.length} rader till hantverk_pafyllning …`);
for (let i = 0; i < rader.length; i += 500) {
  await rest("hantverk_pafyllning?on_conflict=cfarnr", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rader.slice(i, i + 500)),
  });
}

// Rader ur samma omgång som inte längre uppfyller villkoren tas bort.
const nu = new Set(rader.map((r) => r.cfarnr));
const fanns = [];
for (let off = 0; ; off += 1000) {
  const bit = await rest(`hantverk_pafyllning?select=cfarnr&omgang=eq.${OMGANG}&order=cfarnr&offset=${off}&limit=1000`);
  fanns.push(...bit.map((r) => r.cfarnr));
  if (bit.length < 1000) break;
}
const bort = fanns.filter((c) => !nu.has(c));
for (let i = 0; i < bort.length; i += 300) {
  await rest(`hantverk_pafyllning?cfarnr=in.(${bort.slice(i, i + 300).join(",")})`, { method: "DELETE" });
}
console.error(`  borttagna: ${bort.length}`);

writeFileSync(new URL("../src/lib/seo-snapshot-pafyllning.ts", import.meta.url), snapshot);
console.error("Skrev src/lib/seo-snapshot-pafyllning.ts");
// Steg två bygger på påfyllningen: efterföljarna och den materialiserade vyn
// hantverk_foretag_steg2 måste räknas om efter varje import.
console.error("Kör nu scripts/steg2-upphorda.mjs, så att steg två följer med (lib/sql/hantverk-steg2-004.sql).");
