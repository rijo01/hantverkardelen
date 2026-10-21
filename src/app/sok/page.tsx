import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { kommunByCode, kommunBySlug } from "@/lib/kommuner";
import { lanBySlug } from "@/lib/lan";
import {
  branschPageSlug,
  searchForetag,
} from "@/lib/queries";
import { getBranschName } from "@/lib/branscher";
import { getKategoriBySlug } from "@/lib/hantverk-kategorier";
import { yrkesnamn } from "@/lib/yrkesnamn";
import { JsonLd, buildBreadcrumb } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
import { SearchBar } from "@/components/search-bar";
import { CompanyCard, CompanyCardList } from "@/components/company-card";
import { loadAktivaOverlays, overlayFor } from "@/lib/overlay";
import { ordnaBoostade } from "@/lib/overlay-rankning";
import { FilterPanel, buildHref, type FilterState } from "@/components/filter-panel";
import {
  SNABBVAL,
  kategoriNamn,
  parametrarFor,
  tolkaSokfraga,
  type Tolkning,
} from "@/lib/sokfraga";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";
const PAGE_SIZE = 25;

type Search = Promise<{
  q?: string;
  kommun?: string;
  lan?: string;
  postort?: string;
  bransch?: string;
  /** Kategori-slug från startsidans kort (hantverk-kategorier.ts). */
  kategori?: string;
  aeantMin?: string;
  aeantMax?: string;
  page?: string;
}>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Search;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const title = query
    ? `Sökresultat för "${query}"`
    : "Sök hantverkare i Sverige";
  return {
    title,
    description:
      "Sök bland Sveriges hantverksföretag — elektriker, VVS, snickare, målare, byggföretag, takläggare, golv och städ. Filtrera på kommun, bransch och antal anställda.",
    robots: { index: false, follow: true },
  };
}

export default async function SokPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();

  // "elektriker kungälv" → ?kategori=el&kommun=kungalv. Söket förstår bara
  // ett ord i taget som yrke; här översätts hela frågan till parametrar det
  // redan förstår. Bara när varje ord gick att placera — se lib/sokfraga.ts.
  // Sidan är noindex, så omdirigeringen rör inga SEO-grindar.
  const tolkning: Tolkning | null = query && !sp.kategori ? tolkaSokfraga(query) : null;
  if (tolkning) {
    const tolkat = parametrarFor(tolkning);
    if (tolkat) {
      if (!tolkning.ort) {
        for (const k of ["kommun", "lan", "postort"] as const) {
          if (sp[k]) tolkat.set(k, sp[k]!);
        }
      }
      for (const k of ["aeantMin", "aeantMax"] as const) {
        if (sp[k]) tolkat.set(k, sp[k]!);
      }
      redirect(`/sok?${tolkat}`);
    }
    // "hantverkare kungälv" — alla yrken i en kommun är kommunsidan.
    if (tolkning.allaYrken && tolkning.ort?.typ === "kommun" && tolkning.rest.length === 0) {
      redirect(`/kommun/${tolkning.ort.kommun.slug}`);
    }
  }

  const kommun = sp.kommun ? kommunBySlug(sp.kommun) : undefined;
  const lan = sp.lan ? lanBySlug(sp.lan) : undefined;
  const postort = sp.postort?.trim() || undefined;
  const ng1 = sp.bransch ? Number(sp.bransch) : undefined;
  const aeantMin = sp.aeantMin ? Number(sp.aeantMin) : undefined;
  const aeantMax = sp.aeantMax ? Number(sp.aeantMax) : undefined;
  const kategori = sp.kategori ? getKategoriBySlug(sp.kategori) : null;

  const filterState: FilterState = {
    q: sp.q,
    kategori: sp.kategori,
    kommun: sp.kommun,
    lan: sp.lan,
    postort: sp.postort,
    bransch: sp.bransch,
    aeantMin: sp.aeantMin,
    aeantMax: sp.aeantMax,
  };

  const pageLabel = query
    ? `Sökresultat: ${query}`
    : kategori
      ? kategoriNamn(kategori.slug)
      : "Sök";
  const breadcrumbItems = [
    { name: "Hantverkardelen", href: "/" },
    { name: pageLabel },
  ];
  const breadcrumbJsonLd = buildBreadcrumb([
    { name: "Hantverkardelen", url: SITE_URL },
    { name: pageLabel, url: `${SITE_URL}/sok` },
  ]);

  // Visa resultaten även när det inte finns query, så länge en kategori valts.
  const showResults = Boolean(query) || Boolean(kategori);

  return (
    <div className="space-y-6">
      <JsonLd data={breadcrumbJsonLd} />
      <Breadcrumb items={breadcrumbItems} />

      <SearchBar
        key={`${sp.q ?? ""}|${sp.kategori ?? ""}|${sp.kommun ?? ""}|${sp.lan ?? ""}|${sp.postort ?? ""}`}
        variant="dual"
        preserveFilters
        kompakt
        params={sp}
      />

      {!showResults ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr] lg:gap-8">
          <FilterPanel state={filterState} pathname="/sok" />
          <Suspense
            key={`${query}|${sp.kategori ?? ""}|${sp.kommun ?? ""}|${sp.lan ?? ""}|${sp.postort ?? ""}|${ng1 ?? ""}|${aeantMin ?? ""}|${aeantMax ?? ""}|${sp.page ?? "1"}`}
            fallback={
              <ResultsSkeleton
                rubrik={sokRubrik({ query, kommun, postort, lan, kategoriSlug: kategori?.slug, ng1 })}
              />
            }
          >
            <ResultsAsync
              query={query}
              kategoriSlug={kategori?.slug ?? null}
              kommun={kommun}
              lan={lan}
              postort={postort}
              ng1={ng1}
              aeantMin={aeantMin}
              aeantMax={aeantMax}
              pageStr={sp.page}
              filterState={filterState}
              tolkning={tolkning}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

async function ResultsAsync({
  query,
  kategoriSlug,
  kommun,
  lan,
  postort,
  ng1,
  aeantMin,
  aeantMax,
  pageStr,
  filterState,
  tolkning,
}: {
  query: string;
  kategoriSlug: string | null;
  kommun: ReturnType<typeof kommunBySlug>;
  lan: ReturnType<typeof lanBySlug>;
  postort?: string;
  ng1?: number;
  aeantMin?: number;
  aeantMax?: number;
  pageStr?: string;
  filterState: FilterState;
  tolkning: Tolkning | null;
}) {
  const page = Math.max(1, Number(pageStr) || 1);
  const kategori = kategoriSlug ? getKategoriBySlug(kategoriSlug) : null;

  // Söksidan är force-dynamic och läser alltså overlay vid VARJE request. Det
  // är avsiktligt: en publicering ska synas i söket direkt, och det finns ingen
  // cache här att revalidera.
  // Yrket i en enskild kommun har en egen landningssida när yrket är en enda
  // bransch. Namnet (för länkens slug) hämtas parallellt med söket — i serie
  // efter det kostade det ~400 ms till första träff.
  const landningNg1 =
    kommun && kategori && kategori.ng1.length === 1 ? kategori.ng1[0] : null;
  const [
    { rows: oboostade, hasMore, matchedBransch, total },
    overlays,
    landningNamn,
    branschName,
  ] = await Promise.all([
    searchForetag(query, {
      kommun: kommun?.code,
      lan: lan?.code,
      postort,
      ng1,
      ng1List: kategori?.ng1,
      aeantMin,
      aeantMax,
      page,
      pageSize: PAGE_SIZE,
    }),
    loadAktivaOverlays(),
    landningNg1 ? getBranschName(landningNg1) : Promise.resolve(null),
    ng1 ? getBranschName(ng1) : Promise.resolve(null),
  ]);
  const rows = ordnaBoostade(oboostade, overlays);

  const offset = (page - 1) * PAGE_SIZE;
  // Samma rubrik som skelettet visar medan söket körs — den beror bara på
  // adressen, så den står still när träffarna kommer.
  const rubrik = sokRubrik({ query, kommun, postort, lan, kategoriSlug, ng1 });
  const harUtvalda = rows.some((f) => overlayFor(f, overlays)?.featured);
  const harKompletta = rows.some((f) => (f.poang ?? 0) > 0);
  const sortering = [
    harUtvalda && "Utvalda (annons) först",
    harKompletta && (harUtvalda ? "sedan komplett profil" : "Komplett profil först"),
    harUtvalda || harKompletta ? "sedan efter antal anställda." : "Sorterat efter antal anställda.",
  ]
    .filter(Boolean)
    .join(", ");
  const fran = offset + 1;
  const till = offset + rows.length;

  const landning =
    landningNg1
      ? { ng1: landningNg1, namn: landningNamn }
      : kommun && ng1 && branschName
        ? { ng1, namn: branschName }
        : null;

  return (
    <div className="min-w-0 space-y-5">
      <header className="space-y-1.5">
        <h1 className="rd-serif text-[2rem] text-[var(--text-strong)] sm:text-[2.5rem]">
          {rubrik}
        </h1>
        <p className="text-[15px] text-[var(--text-muted)]">
          {rows.length === 0 ? (
            "Inga träffar."
          ) : (
            <>
              <span className="font-semibold text-[var(--text-strong)]">
                {total != null
                  ? `${total.toLocaleString("sv-SE")} företag`
                  : `${rows.length} träff${rows.length === 1 ? "" : "ar"}`}
              </span>
              {total != null && total > rows.length ? `, visar ${fran}\u2013${till}` : ""}
              {". "}
              {sortering}
            </>
          )}
        </p>
      </header>

      {rows.length === 0 ? (
        <TomtResultat query={query} tolkning={tolkning} kommunSlug={kommun?.slug} kommunNamn={kommun?.name} />
      ) : (
        <CompanyCardList>
          {rows.map((f) => {
            const k = f.kommun ? kommunByCode(f.kommun) : null;
            return (
              <li key={f.id}>
                <CompanyCard
                  foretag={f}
                  overlay={overlayFor(f, overlays)}
                  branschName={f.ng1 ? yrkesnamn(f.ng1, matchedBransch ?? branschName) : (matchedBransch ?? branschName)}
                  kommunName={k?.name}
                />
              </li>
            );
          })}
        </CompanyCardList>
      )}

      {(page > 1 || hasMore) && (
        <nav aria-label="Sidor" className="flex items-center justify-between border-t border-[var(--rule)] pt-5 text-sm">
          {page > 1 ? (
            <Link
              href={buildHref("/sok", filterState, { page: page > 2 ? String(page - 1) : null })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--rule)] bg-white px-4 font-medium text-[var(--text-body)] transition hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)] hover:text-[var(--brand-ink)]"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Föregående
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[var(--text-muted)]">Sida {page}</span>
          {hasMore ? (
            <Link
              href={buildHref("/sok", filterState, { page: String(page + 1) })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--rule)] bg-white px-4 font-medium text-[var(--text-body)] transition hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)] hover:text-[var(--brand-ink)]"
            >
              Nästa
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {rows.length > 0 && kommun && landning?.namn && (
        <p className="text-[15px] text-[var(--text-muted)]">
          Se också{" "}
          <Link
            href={`/kommun/${kommun.slug}/${branschPageSlug(landning.namn, landning.ng1)}`}
            className="font-semibold text-[var(--brand-ink)] underline underline-offset-4 decoration-[var(--brand)]/30 hover:decoration-[var(--brand)]"
          >
            {landning.namn} i {kommun.name}
          </Link>{" "}
          med närliggande kommuner och andra yrken i orten.
        </p>
      )}
    </div>
  );
}

/**
 * Noll träffar är en återvändsgränd bara om sidan lämnar besökaren där.
 * Här står vad som gick fel och vad som finns i stället.
 */
function TomtResultat({
  query,
  tolkning,
  kommunSlug,
  kommunNamn,
}: {
  query: string;
  tolkning: Tolkning | null;
  kommunSlug?: string;
  kommunNamn?: string;
}) {
  const ortParam = kommunSlug ? `&kommun=${kommunSlug}` : "";
  const ortText = kommunNamn ? ` i ${kommunNamn}` : "";
  return (
    <div className="rounded-xl border border-[var(--rule)] bg-white p-6 sm:p-8">
      {tolkning?.saknatYrke ? (
        <>
          <p className="text-lg font-semibold text-[var(--text-strong)]">
            {tolkning.saknatYrke} finns inte i katalogen
          </p>
          <p className="mt-1 max-w-xl text-[15px] text-[var(--text-muted)]">
            Hantverkardelen listar bygg-, el-, VVS-, måleri- och andra
            hantverksföretag. {tolkning.saknatYrke} ingår inte.
          </p>
        </>
      ) : tolkning?.kategori ? (
        <>
          <p className="text-lg font-semibold text-[var(--text-strong)]">
            Vi förstod yrket men inte resten av sökningen
          </p>
          <p className="mt-1 max-w-xl text-[15px] text-[var(--text-muted)]">
            &ldquo;{tolkning.rest.join(" ")}&rdquo; är varken en kommun eller en ort vi
            känner till. Skriv orten i fältet Var?, eller visa alla:
          </p>
          <Link
            href={`/sok?kategori=${tolkning.kategori}${ortParam}`}
            className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-[var(--brand)]/35 px-4 font-semibold text-[var(--brand-ink)] hover:border-[var(--brand)] hover:bg-[var(--tint-1)]"
          >
            {kategoriNamn(tolkning.kategori)}
            {ortText}
          </Link>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold text-[var(--text-strong)]">
            Inget företag heter &ldquo;{query}&rdquo;{ortText}
          </p>
          <p className="mt-1 max-w-xl text-[15px] text-[var(--text-muted)]">
            Söker du ett yrke? Välj det här{ortText ? ", så visar vi alla" + ortText : ""}:
          </p>
        </>
      )}
      <ul className="mt-5 flex flex-wrap gap-2">
        {SNABBVAL.map((s) => (
          <li key={s.kategori}>
            <Link
              href={`/sok?kategori=${s.kategori}${ortParam}`}
              className="inline-flex min-h-10 items-center rounded-lg border border-[var(--rule)] bg-white px-3 text-sm font-medium text-[var(--text-body)] transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)] hover:text-[var(--brand-ink)]"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function sokRubrik({
  query,
  kommun,
  postort,
  lan,
  kategoriSlug,
  ng1,
}: {
  query: string;
  kommun?: { name: string };
  postort?: string;
  lan?: { name: string };
  kategoriSlug?: string | null;
  ng1?: number;
}): string {
  const geo = kommun
    ? ` i ${kommun.name}`
    : postort
      ? ` i ${postort}`
      : lan
        ? ` i ${lan.name}s län`
        : " i hela Sverige";
  if (query) return `\u201d${query}\u201d${kommun ? ` i ${kommun.name}` : ""}`;
  const yrke = kategoriSlug ? kategoriNamn(kategoriSlug) : ng1 ? yrkesnamn(ng1) : "Hantverkare";
  return `${yrke}${geo}`;
}

function ResultsSkeleton({ rubrik }: { rubrik: string }) {
  return (
    <div className="min-w-0 space-y-5" aria-busy="true">
      <header className="space-y-2">
        <h1 className="rd-serif text-[2rem] text-[var(--text-strong)] sm:text-[2.5rem]">
          {rubrik}
        </h1>
        <p className="text-[15px] text-[var(--text-muted)]">Söker i registret…</p>
      </header>
      <ol className="divide-y divide-[var(--rule-soft)] rounded-xl border border-[var(--rule)] bg-white">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1 space-y-2">
              <div className="rd-skeleton h-4 w-[45%] rounded" />
              <div className="rd-skeleton h-3 w-[60%] rounded" />
            </div>
            <div className="rd-skeleton hidden h-11 w-36 rounded-lg sm:block" />
          </li>
        ))}
      </ol>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="max-w-2xl space-y-2 py-6">
      <h1 className="rd-serif text-[2rem] text-[var(--text-strong)] sm:text-[2.5rem]">
        Sök bland hantverkare
      </h1>
      <p className="text-[15px] text-[var(--text-muted)]">
        Skriv ett yrke och en ort, till exempel &ldquo;elektriker Kungälv&rdquo;, eller
        ett företagsnamn.
      </p>
    </div>
  );
}
