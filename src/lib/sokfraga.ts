import { ALL_KOMMUNER, type Kommun } from "./kommuner";
import { ALL_LAN, type Lan } from "./lan";
import { ALL_POSTORTER } from "./postorter";
import { HANTVERK_KATEGORIER } from "./hantverk-kategorier";
import { KOMMUN_FORETAG } from "./seo-snapshot";

/**
 * Tolkning av en fritextfråga som "elektriker kungälv" eller "VVS i Uppsala".
 *
 * Bakgrund: söket slår bara upp en bransch när frågan är ETT ord (se
 * searchForetag i queries.ts). Allt längre blev en ren namnsökning, så
 * "elektriker kungälv" gav noll träffar trots att Kungälv har 56 elektriker —
 * och "yrke + ort" är just den fråga sajten finns till för.
 *
 * Tolkningen sker här, i sidlagret, och översätts till parametrar som söket
 * redan förstår (kategori + kommun/postort/län). Datafrågorna rörs inte.
 *
 * Regeln är försiktig: frågan räknas som "yrke + ort" bara när VARJE ord går
 * att placera — som yrke, som ort eller som småord ("i", "på"). Ett ord kvar
 * betyder att frågan kan vara ett företagsnamn ("Mölndals Målar'n"), och då
 * får namnsöket sköta den som förut.
 */

/** Ord → kategori-slug i hantverk-kategorier.ts. Gemener, utan bindestreck. */
const YRKESORD: Readonly<Record<string, string>> = {
  // El
  el: "el",
  elektriker: "el",
  elektrikern: "el",
  elfirma: "el",
  elinstallatör: "el",
  elinstallatörer: "el",
  elinstallation: "el",
  elinstallationer: "el",
  laddbox: "el",
  // VVS
  vvs: "vvs",
  rörmokare: "vvs",
  rörmokaren: "vvs",
  rörmokeri: "vvs",
  rör: "vvs",
  ventilation: "vvs",
  värmepump: "vvs",
  värmepumpar: "vvs",
  // Måleri
  målare: "maleri",
  målaren: "maleri",
  måleri: "maleri",
  målning: "maleri",
  tapetsering: "maleri",
  tapetserare: "maleri",
  // Snickeri
  snickare: "snickeri",
  snickaren: "snickeri",
  snickeri: "snickeri",
  byggnadssnickare: "snickeri",
  köksmontering: "snickeri",
  // Bygg
  bygg: "bygg",
  byggare: "bygg",
  byggföretag: "bygg",
  byggmästare: "bygg",
  byggentreprenör: "bygg",
  byggentreprenad: "bygg",
  husbyggare: "bygg",
  renovering: "bygg",
  tillbyggnad: "bygg",
  // Tak
  tak: "tak",
  takläggare: "tak",
  takläggning: "tak",
  takarbeten: "tak",
  takrenovering: "tak",
  plåtslagare: "tak",
  // Golv
  golv: "golv",
  golvläggare: "golv",
  golvläggning: "golv",
  parkett: "golv",
  kakel: "golv",
  klinker: "golv",
  plattsättare: "golv",
  // Mark & anläggning
  mark: "mark-anlaggning",
  markarbeten: "mark-anlaggning",
  markentreprenad: "mark-anlaggning",
  markentreprenör: "mark-anlaggning",
  markentreprenörer: "mark-anlaggning",
  anläggning: "mark-anlaggning",
  schakt: "mark-anlaggning",
  grävning: "mark-anlaggning",
  dränering: "mark-anlaggning",
  rivning: "mark-anlaggning",
  // Trädgård
  trädgård: "tradgard",
  trädgårdsskötsel: "tradgard",
  trädgårdsarbete: "tradgard",
  trädgårdsmästare: "tradgard",
  gräsklippning: "tradgard",
  // Glas, puts, betong
  glas: "glas",
  glasmästare: "glas",
  glasmästeri: "glas",
  puts: "puts-fasad",
  fasad: "puts-fasad",
  fasadrenovering: "puts-fasad",
  stuckatör: "puts-fasad",
  betong: "betong",
};

/**
 * Yrken som folk söker på men som katalogen inte har. Städfirmor togs ur
 * nischen 2026-05-26 (se hantverk-branscher.ts) — då ska söket säga det rakt
 * ut i stället för att visa noll träffar utan förklaring.
 */
const SAKNADE_YRKEN: Readonly<Record<string, string>> = {
  städ: "Städfirmor",
  städning: "Städfirmor",
  städfirma: "Städfirmor",
  städare: "Städfirmor",
  flyttstädning: "Städfirmor",
  hemstädning: "Städfirmor",
  låssmed: "Låssmeder",
  skorstensfejare: "Skorstensfejare",
};

const SMAORD = new Set([
  "i", "på", "nära", "runt", "kring", "omkring", "vid", "och", "&", "in",
  // "vvs-firmor", "bra byggfirma": ordet bär ingen egen betydelse för söket.
  "firma", "firmor", "företag", "bra", "billig", "billiga",
]);

/** Ord som betyder "alla yrken" — "hantverkare kungälv" ska till kommunsidan. */
const ALLA_YRKEN = new Set(["hantverkare", "hantverk", "hantverkaren"]);

/** Gemener, utan bindestreck och skiljetecken, enkla mellanslag. */
export function normalisera(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_/,.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function yrkeFor(ord: string): string | null {
  const direkt = YRKESORD[ord];
  if (direkt) return direkt;
  // "elfirmor", "målerifirma", "byggföretagen" — ta bort ändelsen och försök igen.
  const stam = ord.replace(/(firmorna|firmor|firman|firma|företagen|företag)$/, "");
  if (stam !== ord && stam.length >= 2) {
    return YRKESORD[stam] ?? YRKESORD[stam.replace(/i$/, "")] ?? null;
  }
  return null;
}

type OrtTraff =
  | { typ: "kommun"; kommun: Kommun }
  | { typ: "lan"; lan: Lan }
  | { typ: "postort"; postort: string };

const KOMMUN_NAMN = ALL_KOMMUNER.map((k) => ({ k, n: normalisera(k.name) }))
  // Längst först: "upplands väsby" ska vinna över ett ensamt "väsby".
  .sort((a, b) => b.n.length - a.n.length);
const LAN_NAMN = ALL_LAN.map((l) => ({ l, n: normalisera(l.name) }));
const POSTORT_NAMN = ALL_POSTORTER.map((p) => ({ p, n: normalisera(p) }));

/** Hitta en ort som HELA ord i frågan. Returnerar orten och vilka ordindex den tog. */
function hittaOrt(ord: string[]): { ort: OrtTraff; index: Set<number> } | null {
  const text = ` ${ord.join(" ")} `;
  const tagna = (n: string): Set<number> | null => {
    const pos = text.indexOf(` ${n} `);
    if (pos < 0) return null;
    const fore = text.slice(0, pos).trim();
    const start = fore ? fore.split(" ").length : 0;
    const antal = n.split(" ").length;
    return new Set(Array.from({ length: antal }, (_, i) => start + i));
  };
  // Kommun före län: "VVS Uppsala" betyder nästan alltid kommunen, och det
  // är kommunsidan en besökare väntar sig att landa på.
  for (const { k, n } of KOMMUN_NAMN) {
    const index = tagna(n);
    if (index) return { ort: { typ: "kommun", kommun: k }, index };
  }
  for (const { l, n } of LAN_NAMN) {
    const index = tagna(n) ?? tagna(`${n}s län`) ?? tagna(`${n} län`);
    if (index) return { ort: { typ: "lan", lan: l }, index };
  }
  for (const { p, n } of POSTORT_NAMN) {
    const index = tagna(n);
    if (index) return { ort: { typ: "postort", postort: p }, index };
  }
  return null;
}

export type Tolkning = {
  /** Kategori-slug ur hantverk-kategorier.ts. */
  kategori: string | null;
  ort: OrtTraff | null;
  /** Ord som varken var yrke, ort eller småord. */
  rest: string[];
  /** Ett yrke som katalogen inte har, t.ex. "Städfirmor". */
  saknatYrke: string | null;
  /** Frågan gällde hantverkare i allmänhet, inte ett visst yrke. */
  allaYrken: boolean;
};

export function tolkaSokfraga(fraga: string): Tolkning {
  const ord = normalisera(fraga).split(" ").filter(Boolean);
  const traff = hittaOrt(ord);
  let kategori: string | null = null;
  let saknatYrke: string | null = null;
  let allaYrken = false;
  const rest: string[] = [];
  ord.forEach((o, i) => {
    if (traff?.index.has(i)) return;
    if (SMAORD.has(o)) return;
    if (ALLA_YRKEN.has(o)) {
      allaYrken = true;
      return;
    }
    const k = yrkeFor(o);
    if (k && (!kategori || kategori === k)) {
      kategori = k;
      return;
    }
    if (SAKNADE_YRKEN[o]) {
      saknatYrke = SAKNADE_YRKEN[o];
      return;
    }
    rest.push(o);
  });
  return { kategori, ort: traff?.ort ?? null, rest, saknatYrke, allaYrken };
}

/** Sökparametrar för en tolkning som gick att placera helt, annars null. */
export function parametrarFor(t: Tolkning): URLSearchParams | null {
  if (!t.kategori || t.rest.length > 0) return null;
  const p = new URLSearchParams({ kategori: t.kategori });
  if (t.ort?.typ === "kommun") p.set("kommun", t.ort.kommun.slug);
  else if (t.ort?.typ === "lan") p.set("lan", t.ort.lan.slug);
  else if (t.ort?.typ === "postort") p.set("postort", t.ort.postort);
  return p;
}

/**
 * Vad besökaren kallar yrket — "Elektriker", inte kategorins "El & installation".
 * Används i förslag och rubriker där det står "X i Ort".
 */
const YRKESETIKETT: Readonly<Record<string, string>> = {
  el: "Elektriker",
  maleri: "Målare",
  vvs: "VVS & rör",
  snickeri: "Snickare",
  bygg: "Byggföretag",
  tak: "Takläggare",
  golv: "Golvläggare",
  "mark-anlaggning": "Mark & entreprenad",
  tradgard: "Trädgård",
  glas: "Glasmästare",
  "puts-fasad": "Puts & fasad",
  betong: "Betong",
};

export function kategoriNamn(slug: string): string {
  return (
    YRKESETIKETT[slug] ??
    HANTVERK_KATEGORIER.find((k) => k.slug === slug)?.name ??
    slug
  );
}

export type Kombination = { label: string; href: string };

/**
 * Förslag "Yrke i Ort" medan besökaren skriver. Sista ordet får vara
 * ofullständigt: "elektriker kung" föreslår Kungälv, Kungsbacka och Kungsör.
 */
export function kombinationsforslag(fraga: string, max = 4): Kombination[] {
  const ord = normalisera(fraga).split(" ").filter(Boolean);
  if (ord.length < 2) return [];
  const hel = tolkaSokfraga(fraga);
  const params = parametrarFor(hel);
  if (params && hel.ort) {
    return [{ label: etikett(hel.kategori!, hel.ort), href: `/sok?${params}` }];
  }
  // Sista ordet som början på ett kommunnamn.
  const sista = ord[ord.length - 1];
  const fore = tolkaSokfraga(ord.slice(0, -1).join(" "));
  if (!fore.kategori || fore.rest.length > 0 || fore.ort || sista.length < 2) return [];
  // Störst först: "kung" ska föreslå Kungsbacka och Kungälv före Kungsör.
  return KOMMUN_NAMN.filter(({ n }) => n.startsWith(sista))
    .map(({ k }) => k)
    .sort((a, b) => (KOMMUN_FORETAG[b.code] ?? 0) - (KOMMUN_FORETAG[a.code] ?? 0))
    .slice(0, max)
    .map((k) => ({
      label: etikett(fore.kategori!, { typ: "kommun", kommun: k }),
      href: `/sok?kategori=${fore.kategori}&kommun=${k.slug}`,
    }));
}

function etikett(kategori: string, ort: OrtTraff): string {
  const plats =
    ort.typ === "kommun"
      ? ort.kommun.name
      : ort.typ === "lan"
        ? `${ort.lan.name}s län`
        : ort.postort;
  return `${kategoriNamn(kategori)} i ${plats}`;
}

/** Snabbval på startsidan och i tomma sökresultat. */
export const SNABBVAL: ReadonlyArray<{ label: string; kategori: string }> = [
  { label: "Elektriker", kategori: "el" },
  { label: "Målare", kategori: "maleri" },
  { label: "VVS", kategori: "vvs" },
  { label: "Snickare", kategori: "snickeri" },
  { label: "Bygg", kategori: "bygg" },
  { label: "Tak", kategori: "tak" },
  { label: "Golv", kategori: "golv" },
  { label: "Mark & entreprenad", kategori: "mark-anlaggning" },
  { label: "Trädgård", kategori: "tradgard" },
];
