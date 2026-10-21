import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_KOMMUNER, kommunBySlug } from "@/lib/kommuner";
import { lanByCode } from "@/lib/lan";
import { yrkesnamn } from "@/lib/yrkesnamn";
import { SearchBar } from "@/components/search-bar";
import {
  branschPageSlug,
  countForetagInKommun,
  getBranschFordelning,
  listForetagInKommun,
} from "@/lib/queries";
import { getBranschNamesBulk } from "@/lib/branscher";
import { JsonLd, buildBreadcrumb } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
import { hubIsIndexable, robotsFor, snapshotKommunCount } from "@/lib/seo";
import { CompanyCard, CompanyCardList } from "@/components/company-card";
import { loadAktivaOverlays, overlayFor } from "@/lib/overlay";
import { ordnaBoostade } from "@/lib/overlay-rankning";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";
const fmt = (n: number) => n.toLocaleString("sv-SE");

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const kommun = kommunBySlug(slug);
  if (!kommun) return { title: "Kommun hittades inte" };
  const title = `Hantverkare i ${kommun.name} kommun`;
  const description = `Hem- & hantverkskatalog för ${kommun.name} kommun. Hitta elektriker, VVS, snickare, målare, byggföretag, takläggare och städ i ${kommun.name}.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/kommun/${kommun.slug}` },
    openGraph: { title, description, type: "website", locale: "sv_SE" },
    // Grind 1, se lib/seo.ts — en kommun med för få företag är en tunn sida.
    robots: robotsFor(hubIsIndexable(snapshotKommunCount(kommun.code))),
  };
}

export default async function KommunPage({ params }: { params: Params }) {
  const { slug } = await params;
  const kommun = kommunBySlug(slug);
  if (!kommun) notFound();

  // Exakt count vid render. Tidigare lästes ett förberäknat värde ur stats.ts
  // när det fanns — och just de värdena var 1001-artefakter från
  // count=estimated. Nu räknar vi alltid, det kostar ~350 ms en gång per dygn.
  const [liveTotal, fordelning, oboostadeForetag, overlays] = await Promise.all([
    countForetagInKommun(kommun.code),
    getBranschFordelning(kommun.code, 24),
    listForetagInKommun(kommun.code, 12),
    loadAktivaOverlays(),
  ]);

  // Overlay-vikten läggs ovanpå sajtens ordning (störst arbetsgivare först).
  // Stabil sortering: den som inte köpt framhävning står kvar där den stod.
  const foretagSample = ordnaBoostade(oboostadeForetag, overlays);

  const branschNames = await getBranschNamesBulk(fordelning.map((f) => f.ng1));

  const lan = lanByCode(kommun.lan);
  // Närliggande = samma län. Grannskapsdata finns inte; länet är det ärliga
  // närmevärdet. Bara kommuner vars sida passerar indexgrinden, så att
  // länkarna aldrig leder till en noindex-sida.
  const grannar = ALL_KOMMUNER.filter(
    (k) => k.lan === kommun.lan && k.code !== kommun.code,
  )
    .map((k) => ({ k, n: snapshotKommunCount(k.code) }))
    .filter(({ n }) => hubIsIndexable(n))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);

  const breadcrumbItems = [
    { name: "Hantverkardelen", href: "/" },
    { name: kommun.name, href: `/kommun/${kommun.slug}` },
  ];

  const breadcrumbJsonLd = buildBreadcrumb([
    { name: "Hantverkardelen", url: SITE_URL },
    { name: kommun.name, url: `${SITE_URL}/kommun/${kommun.slug}` },
  ]);

  const genitiv = kommun.name.endsWith("s") ? kommun.name : `${kommun.name}s`;

  return (
    <div className="space-y-12 pb-8">
      <JsonLd data={breadcrumbJsonLd} />
      <Breadcrumb items={breadcrumbItems} />

      <header className="max-w-4xl space-y-4">
        <h1 className="rd-serif text-balance text-[2.5rem] text-[var(--text-strong)] sm:text-[3.5rem]">
          Hantverkare i {kommun.name}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-[var(--text-muted)]">
          <span className="font-semibold tabular-nums text-[var(--text-strong)]">
            {fmt(liveTotal)}
          </span>{" "}
          registrerade hantverksföretag i {genitiv} kommun
          {lan ? <>, {lan.name}s län</> : null}. Välj ett yrke, eller sök efter ett
          företag.
        </p>
        <div className="pt-2">
          <SearchBar variant="dual" initialOrt={kommun.name} snabbval />
        </div>
      </header>

      {fordelning.length > 0 && (
        <section aria-labelledby="yrken">
          <h2 id="yrken" className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
            Yrken i {kommun.name}
          </h2>
          <ul className="mt-5 grid grid-cols-1 border-t border-[var(--rule)] sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
            {fordelning.map((f) => {
              const registerNamn = branschNames.get(String(f.ng1)) ?? null;
              const namn = yrkesnamn(f.ng1, registerNamn);
              const href = `/kommun/${kommun.slug}/${branschPageSlug(registerNamn ?? namn, f.ng1)}`;
              return (
                <li key={f.ng1} className="border-b border-[var(--rule)]">
                  <Link
                    href={href}
                    className="group flex min-h-12 items-center justify-between gap-3 py-2.5"
                  >
                    <span className="truncate font-medium text-[var(--text-strong)] underline-offset-4 group-hover:text-[var(--brand-ink)] group-hover:underline">
                      {namn}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-[var(--text-muted)]">
                      {fmt(f.count)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="storst" className="space-y-4">
        <div>
          <h2 id="storst" className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
            Flest anställda i {kommun.name}
          </h2>
          <p className="mt-1 text-[15px] text-[var(--text-muted)]">
            De {foretagSample.length} största företagen i registret, alla yrken.
          </p>
        </div>
        {foretagSample.length === 0 ? (
          <p className="text-[15px] text-[var(--text-muted)]">
            Inga hantverksföretag registrerade i {kommun.name}.
          </p>
        ) : (
          <CompanyCardList>
            {foretagSample.map((f) => (
              <li key={f.id}>
                <CompanyCard
                  foretag={f}
                  overlay={overlayFor(f, overlays)}
                  branschName={f.ng1 ? yrkesnamn(f.ng1) : null}
                  kommunName={kommun.name}
                />
              </li>
            ))}
          </CompanyCardList>
        )}
      </section>

      {grannar.length > 0 && lan && (
        <section aria-labelledby="grannar">
          <h2 id="grannar" className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
            Fler kommuner i {lan.name}s län
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {grannar.map(({ k, n }) => (
              <li key={k.code}>
                <Link
                  href={`/kommun/${k.slug}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--rule)] bg-white px-3 text-sm font-medium text-[var(--text-body)] transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)] hover:text-[var(--brand-ink)]"
                >
                  {k.name}
                  <span className="tabular-nums text-[var(--text-muted)]">{fmt(n)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
