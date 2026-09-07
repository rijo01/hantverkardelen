import { getSupabaseAnon } from "./supabase";
import { branschSlug } from "./branscher";
import { HANTVERK_BRANSCHER, HANTVERK_BRANSCHER_SET } from "./hantverk-branscher";
import { kommunCodesForLan } from "./lan";
import { foretagIsIndexable } from "./seo";

type GeoFilter = { kommun?: string; postort?: string; lan?: string };

/**
 * Applicera geo-filter på en query-builder. Mutex — bara ett filter appliceras.
 * Prioritet (mest specifik vinner): kommun > postort > lan.
 *
 *   lan → .in("kommun", [alla kommuner i länet]) via kommuner.ts-mappningen.
 *     DB:s lan-kolumn har data-dirt (samma kommun har 2-4 olika lan-värden +
 *     NULL-rader), så vi går via auktoritativa SCB-koden i kommuner.ts.
 *     Bonus: använder existerande (kommun, ng1, aeant DESC)-index direkt.
 */
function applyGeoFilter<T>(q: T, opts: GeoFilter): T {
  if (opts.kommun) return (q as unknown as { eq(c: string, v: string): T }).eq("kommun", opts.kommun);
  if (opts.postort) return (q as unknown as { ilike(c: string, v: string): T }).ilike("postort", opts.postort);
  if (opts.lan) {
    const codes = kommunCodesForLan(opts.lan);
    if (codes.length > 0) return (q as unknown as { in(c: string, v: string[]): T }).in("kommun", codes);
  }
  return q;
}

type AeantFilter = { aeantMin?: number; aeantMax?: number };

/**
 * Applicera storleksfilter (antal anställda) på en query-builder.
 *
 * Filtret appliceras BARA när användaren faktiskt valt ett spann. Tidigare
 * lade varje anropsplats på `.gte("aeant", Math.max(0, aeantMin ?? 0))`, dvs
 * `.gte("aeant", 0)` som default. I SQL är NULL >= 0 inte sant, så de 3 762
 * hantverksföretag som saknar uppgift om antal anställda (4,9 %) föll bort ur
 * varje sökning och varje bransch-lista — utan att något i gränssnittet sa
 * att ett filter var på. Det gjorde också att sidans egna tal inte stämde med
 * katalogens: /branscher sa 1 689 trädgårdsföretag medan söket sa 1 550.
 */
function applyAeantFilter<T>(q: T, opts: AeantFilter): T {
  let out = q;
  if (opts.aeantMin != null && opts.aeantMin > 0) {
    out = (out as unknown as { gte(c: string, v: number): T }).gte("aeant", opts.aeantMin);
  }
  if (opts.aeantMax != null && opts.aeantMax > 0) {
    out = (out as unknown as { lte(c: string, v: number): T }).lte("aeant", opts.aeantMax);
  }
  return out;
}

/**
 * Datalager. Alla anrop går mot vyn `foretag_publik` via anon-nyckeln.
 *
 * Hantverkardelen-nisch: ALLA företagsqueries filtreras med
 * .in("ng1", HANTVERK_BRANSCHER) så att enbart hem- & hantverksföretag visas.
 * Whitelist lever i src/lib/hantverk-branscher.ts. Single-bransch-queries
 * (.eq("ng1", X)) guardas dessutom så att icke-hantverk-id ger tomt resultat
 * innan vi når DB.
 *
 * Personuppgifter: vyn exponerar `orgnr` och `ar_enskild_firma`. Någon kolumn
 * `orgnr_masked` finns inte — kommentaren här påstod det tidigare, vilket gav
 * intrycket att numren maskades någonstans. Det görs ingen maskning alls.
 * Skyddet ligger i vyn: för enskilda firmor (där numret är ett personnummer)
 * är `orgnr` NULL, medan juridiska personers organisationsnummer visas i sin
 * helhet. Se src/lib/dataprovenans.ts för hur detta beskrivs för användaren.
 *
 * Räkning: ALLA antal som visas för användaren kommer från head+count-frågor
 * med `count: "exact"`. Använd ALDRIG `count: "estimated"` här — PostgREST
 * räknar då exakt bara upp till max_rows (1000) och returnerar annars 1001,
 * eller planerarens gissning som kan slå fel med tiotals procent (Stockholm:
 * estimated 9377 vs exakt 5599). Det gav fabricerade "1 001" över hela sajten.
 * Exakt count mättes till 330-430 ms även på de tyngsta filtren 2026-09-07.
 *
 * Samma tak gäller radhämtning: `.limit(n)` över 1000 kapas tyst av PostgREST,
 * så antal får aldrig härledas ur `data.length` på en obegränsad mängd.
 */

export type Foretag = {
  id: number;
  cfarnr: number;
  firma: string | null;
  namn: string | null;
  gatuadress: string | null;
  postnr: number | null;
  postort: string | null;
  tel: string | null;
  webb: string | null;
  epostadress: string | null;
  ng1: number | null;
  kommun: string | null;
  aeant: number | null;
  /**
   * Rått orgnr för juridiska personer. NULL för enskild firma och andra
   * fysisk-person-fall (då är källkolumnen ett personnummer som DB-vyn
   * filtrerar bort av GDPR-skäl).
   */
  orgnr: string | null;
  /** True om bolaget är en enskild firma — då döljer vi orgnr i UI. */
  arEnskildFirma: boolean;
  /** SCB juridisk form-kod, se lib/jurform.ts för mappning. */
  jurform: number | null;
  /** Premium-poäng — högt värde = betalkund, ska rankas överst. */
  poang: number | null;
  /** Företagsbeskrivning (HTML, behöver saneras innan rendering). */
  infotext: string | null;
  /** Logotyp-URL (kan vara relativ till gamla servern → validera innan visning). */
  logotyp: string | null;
  /** Kontaktperson — publikt namn, OK att visa. */
  kontaktperson: string | null;
};

type PublikRow = {
  id: number;
  cfarnr: number;
  firma: string | null;
  namn: string | null;
  gatuadress: string | null;
  postnr: number | null;
  postort: string | null;
  tel: string | null;
  webb: string | null;
  epostadress: string | null;
  ng1: number | null;
  kommun: string | null;
  aeant: number | null;
  orgnr: string | null;
  ar_enskild_firma: boolean | null;
  jurform: number | null;
  poang: number | null;
  infotext: string | null;
  logotyp: string | null;
  kontaktperson: string | null;
};

const VIEW = "foretag_publik";

const COLUMNS =
  "id,cfarnr,firma,namn,gatuadress,postnr,postort,tel,webb,epostadress,ng1,kommun,aeant,orgnr,ar_enskild_firma,jurform,poang,infotext,logotyp,kontaktperson";

const COLUMNS_LIST =
  "id,cfarnr,firma,namn,gatuadress,postnr,postort,tel,webb,epostadress,ng1,kommun,aeant,orgnr,ar_enskild_firma,jurform,poang,logotyp,kontaktperson";

function mapRow(row: Partial<PublikRow>): Foretag {
  return {
    id: row.id ?? 0,
    cfarnr: row.cfarnr ?? 0,
    firma: row.firma ?? null,
    namn: row.namn ?? null,
    gatuadress: row.gatuadress ?? null,
    postnr: row.postnr ?? null,
    postort: row.postort ?? null,
    tel: row.tel ?? null,
    webb: row.webb ?? null,
    epostadress: row.epostadress ?? null,
    ng1: row.ng1 ?? null,
    kommun: row.kommun ?? null,
    aeant: row.aeant ?? null,
    orgnr: row.orgnr ?? null,
    arEnskildFirma: row.ar_enskild_firma ?? false,
    jurform: row.jurform ?? null,
    poang: row.poang ?? null,
    infotext: row.infotext ?? null,
    logotyp: row.logotyp ?? null,
    kontaktperson: row.kontaktperson ?? null,
  };
}

/** Antal hantverksföretag i en kommun — exakt count, inom Hantverkardelens nisch. */
export async function countForetagInKommun(kommunCode: string): Promise<number> {
  const supa = getSupabaseAnon();
  const { count, error } = await supa
    .from(VIEW)
    .select("id", { count: "exact", head: true })
    .eq("kommun", kommunCode)
    .in("ng1", HANTVERK_BRANSCHER);
  if (error) {
    console.error("countForetagInKommun", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Största arbetsgivare (inom nischen) i en kommun.
 */
export async function listForetagInKommun(
  kommunCode: string,
  limit = 10,
): Promise<Foretag[]> {
  const supa = getSupabaseAnon();
  const { data, error } = await supa
    .from(VIEW)
    .select(COLUMNS_LIST)
    .eq("kommun", kommunCode)
    .in("ng1", HANTVERK_BRANSCHER)
    .order("aeant", { ascending: false, nullsFirst: false })
    .order("cfarnr", { ascending: true })
    .limit(limit);
  if (error || !data) {
    console.error("listForetagInKommun", error);
    return [];
  }
  return (data as Partial<PublikRow>[]).map(mapRow);
}

/**
 * Branschfördelning i en kommun — endast hantverks-branscher.
 *
 * En head+count-fråga per bransch i whitelisten (29 st) istället för att
 * skanna rader och räkna i JS. Den gamla varianten hämtade `.limit(5000)`,
 * men PostgREST kapar tyst vid max_rows=1000, så fördelningen för varje
 * kommun med fler än 1000 hantverksföretag var systematiskt fel.
 * Sidan är ISR-cachad (revalidate 86400) så kostnaden tas en gång per dygn.
 */
export async function getBranschFordelning(
  kommunCode: string,
  limit = 20,
): Promise<Array<{ ng1: number; count: number }>> {
  const supa = getSupabaseAnon();
  const results = await Promise.all(
    HANTVERK_BRANSCHER.map(async (ng1) => {
      const { count, error } = await supa
        .from(VIEW)
        .select("id", { count: "exact", head: true })
        .eq("kommun", kommunCode)
        .eq("ng1", ng1);
      if (error) {
        // Hellre utelämna branschen än visa ett tal vi inte kan stå för.
        console.error("getBranschFordelning", ng1, error);
        return null;
      }
      return { ng1, count: count ?? 0 };
    }),
  );
  return results
    .filter((r): r is { ng1: number; count: number } => r != null && r.count > 0)
    .sort((a, b) => b.count - a.count || a.ng1 - b.ng1)
    .slice(0, limit);
}

/**
 * Företag i kommun + bransch, paginerat.
 */
export async function listForetagInKommunByBransch(
  kommunCode: string,
  ng1: number,
  opts: {
    page?: number;
    pageSize?: number;
    aeantMin?: number;
    aeantMax?: number;
  } = {},
): Promise<{ rows: Foretag[]; hasMore: boolean; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize;

  // Guard: blocka icke-hantverk-id helt — vi vill aldrig att en användare
  // navigerar till /kommun/X/restaurang-12345 och får faktiska restauranger.
  if (!HANTVERK_BRANSCHER_SET.has(ng1)) {
    return { rows: [], hasMore: false, page, pageSize };
  }

  const supa = getSupabaseAnon();
  let q = supa
    .from(VIEW)
    .select(COLUMNS_LIST)
    .eq("kommun", kommunCode)
    .eq("ng1", ng1);
  q = applyAeantFilter(q, opts);

  const { data, error } = await q
    .order("poang", { ascending: false, nullsFirst: false })
    .order("aeant", { ascending: false, nullsFirst: false })
    .order("cfarnr", { ascending: true })
    .range(from, to);
  if (error || !data) {
    console.error("listForetagInKommunByBransch", error);
    return { rows: [], hasMore: false, page, pageSize };
  }
  const rows = data as Partial<PublikRow>[];
  const hasMore = rows.length > pageSize;
  return {
    rows: rows.slice(0, pageSize).map(mapRow),
    hasMore,
    page,
    pageSize,
  };
}

/**
 * Slå upp branschid:n vars beskrivning matchar query — filtrerat på
 * hantverk-whitelist så att "städ" inte drar in t.ex. städjuridik
 * och "el" inte drar in elproduktion utanför installationssidan.
 */
export async function findBranschIdsForQuery(
  query: string,
): Promise<{ ids: number[]; primaryName: string | null }> {
  const cleaned = query.trim();
  if (cleaned.length < 2) return { ids: [], primaryName: null };

  const supa = getSupabaseAnon();
  const safe = cleaned.replace(/[%_]/g, " ").trim();
  const { data, error } = await supa
    .from("t_bransch")
    .select("branschid, beskrivning")
    .ilike("beskrivning", `%${safe}%`)
    .in("branschid", HANTVERK_BRANSCHER)
    .limit(30);
  if (error || !data) return { ids: [], primaryName: null };

  const rows = (
    data as Array<{ branschid: number; beskrivning: string | null }>
  ).filter((r): r is { branschid: number; beskrivning: string } =>
    Boolean(r.beskrivning),
  );

  const lower = cleaned.toLowerCase();
  const exact = rows.filter((r) => r.beskrivning.toLowerCase() === lower);
  if (exact.length > 0) {
    return {
      ids: Array.from(new Set(exact.map((r) => r.branschid))),
      primaryName: exact[0]!.beskrivning,
    };
  }

  const prefix = rows.filter((r) =>
    r.beskrivning.toLowerCase().startsWith(lower),
  );
  if (prefix.length > 0) {
    return {
      ids: Array.from(new Set(prefix.map((r) => r.branschid))),
      primaryName: prefix[0]!.beskrivning,
    };
  }

  return {
    ids: Array.from(new Set(rows.map((r) => r.branschid))),
    primaryName: rows[0]?.beskrivning ?? null,
  };
}

/**
 * Smart fritextsök — alltid filtrerat på HANTVERK_BRANSCHER.
 *
 * Strategi:
 *   1. När kategori-filter (ng1List) är aktivt och söktermen är tom — browse hela kategorin.
 *   2. För enord (t.ex. "elektriker") slå upp branschid:n i t_bransch.
 *   3. Om bransch-match finns: kör TVÅ parallella queries och slå ihop:
 *        A) ng1.in.(ids) — sorterat på poäng + aeant
 *        B) textSearch på search_vector — namn-träffar inom whitelisten
 *      Dedupa på cfarnr så samma arbetsställe inte syns två gånger.
 *   4. Annars ren textSearch på search_vector inom whitelisten.
 */
export async function searchForetag(
  query: string,
  opts: {
    kommun?: string;
    lan?: string;
    postort?: string;
    ng1?: number;
    /**
     * Lista av ng1 (för kategori-sök från startsidan). Måste vara en delmängd
     * av HANTVERK_BRANSCHER — kommer från hantverk-kategorier.ts. När detta
     * finns skippar vi bransch-uppslag på sökordet och filtrerar direkt på listan.
     */
    ng1List?: readonly number[];
    aeantMin?: number;
    aeantMax?: number;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ rows: Foretag[]; hasMore: boolean; page: number; pageSize: number; matchedBransch?: string | null; total?: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const cleaned = query.trim();

  if (opts.ng1List && opts.ng1List.length > 0 && cleaned.length < 2) {
    return runKategoriBrowse(opts.ng1List, opts, page, pageSize, from, to);
  }

  if (cleaned.length < 2) {
    return { rows: [], hasMore: false, page, pageSize };
  }

  const isSingleWord = !/\s/.test(cleaned);
  const branschInfo =
    !opts.ng1 && !opts.ng1List && isSingleWord
      ? await findBranschIdsForQuery(cleaned)
      : { ids: [] as number[], primaryName: null as string | null };

  if (branschInfo.ids.length > 0) {
    return runBranschSearch(cleaned, branschInfo, opts, page, pageSize, from, to);
  }

  return runTextSearch(cleaned, opts, page, pageSize, from, to);
}

async function runKategoriBrowse(
  ng1List: readonly number[],
  opts: { kommun?: string; lan?: string; postort?: string; aeantMin?: number; aeantMax?: number },
  page: number,
  pageSize: number,
  from: number,
  to: number,
): Promise<{
  rows: Foretag[];
  hasMore: boolean;
  page: number;
  pageSize: number;
  matchedBransch: null;
  total?: number;
}> {
  const supa = getSupabaseAnon();
  let q = supa
    .from(VIEW)
    .select(COLUMNS_LIST)
    .in("ng1", ng1List as number[]);
  q = applyGeoFilter(q, opts);
  q = applyAeantFilter(q, opts);

  // Total-räkning parallellt med data-queryn. count: exact — se modulnoten:
  // estimated ljuger (kapar vid 1001 / planerargissning). Try/catch så att
  // sajten hellre visar rader helt utan total än ett tal vi inte kan stå för.
  const dataQuery = q
    .order("poang", { ascending: false, nullsFirst: false })
    .order("aeant", { ascending: false, nullsFirst: false })
    .order("cfarnr", { ascending: true })
    .range(from, to);

  const totalPromise: Promise<number | undefined> = (async () => {
    try {
      let cq = supa
        .from(VIEW)
        .select("id", { count: "exact", head: true })
        .in("ng1", ng1List as number[]);
      cq = applyGeoFilter(cq, opts);
      cq = applyAeantFilter(cq, opts);
      const { count, error } = await cq;
      if (error || count == null) return undefined;
      return count;
    } catch {
      return undefined;
    }
  })();

  const [dataRes, total] = await Promise.all([dataQuery, totalPromise]);
  const { data, error } = dataRes;
  if (error || !data) {
    console.error("runKategoriBrowse", error);
    return { rows: [], hasMore: false, page, pageSize, matchedBransch: null, total };
  }
  const rows = data as Partial<PublikRow>[];
  const hasMore = rows.length > pageSize;
  return {
    rows: rows.slice(0, pageSize).map(mapRow),
    hasMore,
    page,
    pageSize,
    matchedBransch: null,
    total,
  };
}

async function runBranschSearch(
  cleaned: string,
  branschInfo: { ids: number[]; primaryName: string | null },
  opts: {
    kommun?: string;
    lan?: string;
    postort?: string;
    aeantMin?: number;
    aeantMax?: number;
  },
  page: number,
  pageSize: number,
  from: number,
  to: number,
): Promise<{
  rows: Foretag[];
  hasMore: boolean;
  page: number;
  pageSize: number;
  matchedBransch: string | null;
  total?: number;
}> {
  const supa = getSupabaseAnon();
  let qA = supa.from(VIEW).select(COLUMNS_LIST).in("ng1", branschInfo.ids);
  qA = applyGeoFilter(qA, opts);
  qA = applyAeantFilter(qA, opts);
  const branschQuery = qA
    .order("poang", { ascending: false, nullsFirst: false })
    .order("aeant", { ascending: false, nullsFirst: false })
    .order("cfarnr", { ascending: true })
    .range(from, to);

  // Total-räkning för bransch-träffen — exakt count, se runKategoriBrowse.
  const totalPromise: Promise<number | undefined> = (async () => {
    try {
      let cq = supa
        .from(VIEW)
        .select("id", { count: "exact", head: true })
        .in("ng1", branschInfo.ids);
      cq = applyGeoFilter(cq, opts);
      cq = applyAeantFilter(cq, opts);
      const { count, error } = await cq;
      if (error || count == null) return undefined;
      return count;
    } catch {
      return undefined;
    }
  })();

  const wantNameSupplement = page === 1;
  const nameQuery = wantNameSupplement
    ? (() => {
        let qB = supa
          .from(VIEW)
          .select(COLUMNS_LIST)
          .textSearch("search_vector", cleaned, {
            type: "websearch",
            config: "swedish_unaccent",
          })
          .in("ng1", HANTVERK_BRANSCHER);
        qB = applyGeoFilter(qB, opts);
        qB = applyAeantFilter(qB, opts);
        return qB
          .order("poang", { ascending: false, nullsFirst: false })
          .order("aeant", { ascending: false, nullsFirst: false })
          .order("cfarnr", { ascending: true })
          .limit(8);
      })()
    : null;

  const sokordQuery = wantNameSupplement ? searchSokordCfarnrs(cleaned) : Promise.resolve([] as number[]);

  const [branschRes, nameRes, sokordCfarnrs, total] = await Promise.all([
    branschQuery,
    nameQuery ?? Promise.resolve({ data: [] as Partial<PublikRow>[], error: null }),
    sokordQuery,
    totalPromise,
  ]);

  if (branschRes.error || !branschRes.data) {
    console.error("searchForetag branschQuery", branschRes.error);
    return runTextSearch(cleaned, opts, page, pageSize, from, to, branschInfo.primaryName);
  }

  const branschRows = branschRes.data as Partial<PublikRow>[];
  const nameRows =
    nameRes && !nameRes.error && nameRes.data ? (nameRes.data as Partial<PublikRow>[]) : [];

  const hasMoreFromBransch = branschRows.length > pageSize;
  const pageBransch = branschRows.slice(0, pageSize);
  const seen = new Set<number>(
    pageBransch.map((r) => r.cfarnr).filter((c): c is number => c != null),
  );
  const extras: Partial<PublikRow>[] = [];
  for (const r of nameRows) {
    if (r.cfarnr == null || seen.has(r.cfarnr)) continue;
    seen.add(r.cfarnr);
    extras.push(r);
  }

  if (sokordCfarnrs.length > 0) {
    const newCfarnrs = sokordCfarnrs.filter((c) => !seen.has(c)).slice(0, 8);
    if (newCfarnrs.length > 0) {
      const sokordRows = await fetchByCfarnrs(newCfarnrs, opts);
      for (const r of sokordRows) {
        if (r.cfarnr == null || seen.has(r.cfarnr)) continue;
        seen.add(r.cfarnr);
        extras.push(r);
      }
    }
  }

  const merged = [...pageBransch, ...extras].slice(0, pageSize);

  return {
    rows: merged.map(mapRow),
    hasMore: hasMoreFromBransch,
    page,
    pageSize,
    matchedBransch: branschInfo.primaryName,
    total,
  };
}

async function runTextSearch(
  cleaned: string,
  opts: { kommun?: string; lan?: string; postort?: string; ng1?: number; aeantMin?: number; aeantMax?: number },
  page: number,
  pageSize: number,
  from: number,
  to: number,
  matchedBransch: string | null = null,
): Promise<{
  rows: Foretag[];
  hasMore: boolean;
  page: number;
  pageSize: number;
  matchedBransch: string | null;
}> {
  const supa = getSupabaseAnon();
  let q = supa
    .from(VIEW)
    .select(COLUMNS_LIST)
    .textSearch("search_vector", cleaned, {
      type: "websearch",
      config: "swedish_unaccent",
    })
    .in("ng1", HANTVERK_BRANSCHER);
  q = applyGeoFilter(q, opts);
  if (opts.ng1 && HANTVERK_BRANSCHER_SET.has(opts.ng1)) q = q.eq("ng1", opts.ng1);
  q = applyAeantFilter(q, opts);

  const textQuery = q
    .order("poang", { ascending: false, nullsFirst: false })
    .order("aeant", { ascending: false, nullsFirst: false })
    .order("cfarnr", { ascending: true })
    .range(from, to);

  const wantSokord = page === 1;
  const sokordQuery = wantSokord
    ? searchSokordCfarnrs(cleaned)
    : Promise.resolve([] as number[]);

  const [textRes, sokordCfarnrs] = await Promise.all([textQuery, sokordQuery]);

  if (textRes.error || !textRes.data) {
    console.error("searchForetag textSearch", textRes.error);
    return { rows: [], hasMore: false, page, pageSize, matchedBransch };
  }
  const rows = textRes.data as Partial<PublikRow>[];
  const hasMore = rows.length > pageSize;
  const pageRows = rows.slice(0, pageSize);
  const seen = new Set<number>(
    pageRows.map((r) => r.cfarnr).filter((c): c is number => c != null),
  );

  const extras: Partial<PublikRow>[] = [];
  if (sokordCfarnrs.length > 0) {
    const newCfarnrs = sokordCfarnrs.filter((c) => !seen.has(c)).slice(0, 8);
    if (newCfarnrs.length > 0) {
      const sokordRows = await fetchByCfarnrs(newCfarnrs, opts);
      for (const r of sokordRows) {
        if (r.cfarnr == null || seen.has(r.cfarnr)) continue;
        seen.add(r.cfarnr);
        extras.push(r);
      }
    }
  }

  const merged = [...pageRows, ...extras].slice(0, pageSize);
  return {
    rows: merged.map(mapRow),
    hasMore,
    page,
    pageSize,
    matchedBransch,
  };
}

/**
 * Liknande hantverksföretag — samma kommun + bransch, exklusive aktuellt.
 */
export async function listRelatedForetag(
  kommunCode: string,
  ng1: number,
  excludeCfarnr: number,
  limit = 6,
): Promise<Foretag[]> {
  if (!HANTVERK_BRANSCHER_SET.has(ng1)) return [];
  const supa = getSupabaseAnon();
  const { data, error } = await supa
    .from(VIEW)
    .select(COLUMNS_LIST)
    .eq("kommun", kommunCode)
    .eq("ng1", ng1)
    .neq("cfarnr", excludeCfarnr)
    .order("poang", { ascending: false, nullsFirst: false })
    .order("aeant", { ascending: false, nullsFirst: false })
    .order("cfarnr", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return (data as Partial<PublikRow>[]).map(mapRow);
}

/**
 * Hitta ett enskilt företag via cfarnr — inkluderar tunga infotext-fält.
 *
 * Returnerar null om företaget ligger utanför hantverks-nischen, så att
 * profil-route:n får 404 istället för att läcka restaurang-, vård- m.fl.
 * företag via direkta URL:er.
 */
export async function getForetagByCfarnr(cfarnr: number): Promise<Foretag | null> {
  const supa = getSupabaseAnon();
  const { data, error } = await supa
    .from(VIEW)
    .select(COLUMNS)
    .eq("cfarnr", cfarnr)
    .in("ng1", HANTVERK_BRANSCHER)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    if (error && error.code !== "PGRST116") console.error("getForetagByCfarnr", error);
    return null;
  }
  return mapRow(data as PublikRow);
}

async function searchSokordCfarnrs(query: string): Promise<number[]> {
  const cleaned = query.trim();
  if (cleaned.length < 3) return [];
  const safe = cleaned.replace(/[%_]/g, " ").trim();

  const supa = getSupabaseAnon();
  const { data, error } = await supa
    .from("sokordtable")
    .select("cfarnr")
    .ilike("sokord", `%${safe}%`)
    .limit(40);
  if (error || !data) {
    if (error) console.warn("searchSokordCfarnrs (RLS?)", error.message);
    return [];
  }
  const ids = new Set<number>();
  for (const row of data as Array<{ cfarnr: number | null }>) {
    if (row.cfarnr != null) ids.add(row.cfarnr);
  }
  return Array.from(ids);
}

export async function listSokordForCfarnr(cfarnr: number): Promise<string[]> {
  const supa = getSupabaseAnon();
  const { data, error } = await supa
    .from("sokordtable")
    .select("sokord")
    .eq("cfarnr", cfarnr)
    .not("sokord", "is", null)
    .limit(60);
  if (error || !data) {
    if (error) console.warn("listSokordForCfarnr", error.message);
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data as Array<{ sokord: string | null }>) {
    const s = (row.sokord ?? "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= 50) break;
  }
  return out;
}

async function fetchByCfarnrs(
  cfarnrs: number[],
  opts: { kommun?: string; lan?: string; postort?: string; aeantMin?: number; aeantMax?: number },
): Promise<Partial<PublikRow>[]> {
  if (cfarnrs.length === 0) return [];
  const supa = getSupabaseAnon();
  let q = supa
    .from(VIEW)
    .select(COLUMNS_LIST)
    .in("cfarnr", cfarnrs)
    .in("ng1", HANTVERK_BRANSCHER);
  q = applyGeoFilter(q, opts);
  q = applyAeantFilter(q, opts);
  const { data, error } = await q
    .order("poang", { ascending: false, nullsFirst: false })
    .order("aeant", { ascending: false, nullsFirst: false });
  if (error || !data) {
    if (error) console.warn("fetchByCfarnrs", error.message);
    return [];
  }
  return data as Partial<PublikRow>[];
}

/**
 * Alla företag som passerar substans-grinden i lib/seo.ts — underlag för
 * sitemap.
 *
 * SQL-villkoret är medvetet ett grovt förfilter, inte grinden. PostgREST kan
 * bara testa `is null`, och databasen innehåller fält som är tomma men inte
 * null — t.ex. epostadress = " ". Grinden foretagIsIndexable() trimmar och
 * underkänner dem. Vi låter därför alltid TS-funktionen ha sista ordet, så
 * att sitemap och sidornas robots-taggar per konstruktion säger samma sak.
 *
 * Pagineras eftersom PostgREST kapar varje svar vid max_rows (1000) och tyst
 * skulle tappa resten.
 */
export async function listIndexableForetag(): Promise<
  Array<Pick<Foretag, "cfarnr" | "firma" | "namn" | "infotext" | "webb" | "epostadress" | "poang">>
> {
  const supa = getSupabaseAnon();
  const PAGE = 1000;
  const out: Array<
    Pick<Foretag, "cfarnr" | "firma" | "namn" | "infotext" | "webb" | "epostadress" | "poang">
  > = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supa
      .from(VIEW)
      .select("cfarnr,firma,namn,webb,epostadress,poang,infotext")
      .in("ng1", HANTVERK_BRANSCHER)
      .or("infotext.not.is.null,webb.not.is.null,epostadress.not.is.null,poang.gt.0")
      .order("cfarnr", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      // Hellre ett brutet bygge än en sitemap som tyst tappar halva listan.
      throw new Error(`listIndexableForetag misslyckades: ${error.message}`);
    }
    const rows = (data ?? []) as Array<Partial<PublikRow>>;
    for (const r of rows) {
      const kandidat = {
        cfarnr: r.cfarnr ?? 0,
        firma: r.firma ?? null,
        namn: r.namn ?? null,
        infotext: r.infotext ?? null,
        webb: r.webb ?? null,
        epostadress: r.epostadress ?? null,
        poang: r.poang ?? null,
      };
      if (foretagIsIndexable(kandidat)) out.push(kandidat);
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

export function foretagSlug(f: Pick<Foretag, "firma" | "namn" | "cfarnr">): string {
  const name = f.firma || f.namn || "foretag";
  const base = name
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "foretag"}-${f.cfarnr}`;
}

export function parseCfarnrFromSlug(slug: string): number | null {
  const m = slug.match(/-(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function branschPageSlug(name: string, ng1: number): string {
  return `${branschSlug(name)}-${ng1}`;
}

export function parseBranschSlug(slug: string): number | null {
  const m = slug.match(/-(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
