import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Layers, MapPin } from "lucide-react";
import { kommunBySlug } from "@/lib/kommuner";
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
  const [liveTotal, fordelning, foretagSample] = await Promise.all([
    countForetagInKommun(kommun.code),
    getBranschFordelning(kommun.code, 24),
    listForetagInKommun(kommun.code, 12),
  ]);

  const branschNames = await getBranschNamesBulk(fordelning.map((f) => f.ng1));

  const breadcrumbItems = [
    { name: "Hantverkardelen", href: "/" },
    { name: kommun.name, href: `/kommun/${kommun.slug}` },
  ];

  const breadcrumbJsonLd = buildBreadcrumb([
    { name: "Hantverkardelen", url: SITE_URL },
    { name: kommun.name, url: `${SITE_URL}/kommun/${kommun.slug}` },
  ]);

  return (
    <div className="space-y-12">
      <JsonLd data={breadcrumbJsonLd} />
      <Breadcrumb items={breadcrumbItems} />

      {/* ======= HERO ======= */}
      <header className="rd-fade-up relative overflow-hidden rounded-3xl border border-[var(--rule)] bg-white rd-shadow-md">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(10,77,140,0.08), transparent 65%),"
              + "radial-gradient(ellipse 50% 40% at 100% 30%, rgba(242,116,12,0.06), transparent 70%),"
              + "linear-gradient(180deg, #F4F6F8 0%, #ffffff 70%)",
          }}
        />
        <div
          aria-hidden
          className="rd-dot-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:linear-gradient(180deg,#000,transparent_70%)]"
        />
        <div className="relative grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-end sm:p-9">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--brand)]">
              <MapPin aria-hidden className="size-3.5" />
              Kommun · Län {kommun.lan}
            </div>
            <h1 className="text-balance text-3xl font-semibold leading-[1.05] tracking-tight text-[var(--text-strong)] sm:text-[2.75rem]">
              Hantverkare i{" "}
              <span className="rd-display rd-text-brand text-[1.15em]">
                {kommun.name}
              </span>
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)] sm:text-base">
              <span>
                <span className="font-mono font-semibold tabular-nums text-[var(--text-strong)]">
                  {fmt(liveTotal)}
                </span>{" "}
                hantverksföretag registrerade
              </span>
              <span aria-hidden className="text-[var(--text-faint)]">·</span>
              <span className="font-mono text-[var(--text-dim)]">
                SCB {kommun.scbCode}
              </span>
            </div>
          </div>
          <Link
            href={`/sok?kommun=${kommun.slug}`}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full rd-brand-gradient rd-cta-shadow px-5 text-sm font-semibold text-white transition hover:brightness-105 active:scale-[0.99]"
          >
            Sök i {kommun.name}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </header>

      {/* ======= LARGEST EMPLOYERS + BRANSCHFÖRDELNING ======= */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="rd-fade-up rd-fade-up-delay-1 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--brand)]">
                Arbetsgivare
              </p>
              <h2 className="text-xl font-semibold text-[var(--text-strong)] sm:text-2xl">
                Största hantverkare i {kommun.name}
              </h2>
            </div>
            <Link
              href={`/sok?kommun=${kommun.slug}`}
              className="hidden text-sm text-[var(--text-muted)] hover:text-[var(--brand-ink)] sm:inline"
            >
              Se alla →
            </Link>
          </div>
          {foretagSample.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Ingen hantverksdata tillgänglig.
            </p>
          ) : (
            <CompanyCardList>
              {foretagSample.map((f, i) => (
                <li key={f.id}>
                  <CompanyCard
                    foretag={f}
                    rank={i + 1}
                    kommunName={kommun.name}
                  />
                </li>
              ))}
            </CompanyCardList>
          )}
        </div>

        <aside className="rd-fade-up rd-fade-up-delay-2 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--brand)]">
                Branscher
              </p>
              <h2 className="text-xl font-semibold text-[var(--text-strong)] sm:text-2xl">
                Hantverkskategorier
              </h2>
            </div>
            <span className="text-xs text-[var(--text-dim)]">
              Topp {fordelning.length}
            </span>
          </div>
          {fordelning.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Ingen branschdata tillgänglig.
            </p>
          ) : (
            <ol className="rd-card divide-y divide-[var(--rule-soft)]">
              {fordelning.map((f) => {
                const name = branschNames.get(String(f.ng1)) ?? `SNI ${f.ng1}`;
                const href = `/kommun/${kommun.slug}/${branschPageSlug(name, f.ng1)}`;
                return (
                  <li key={f.ng1}>
                    <Link
                      href={href}
                      className="rd-row flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                      title={`${name} i ${kommun.name}`}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-[var(--text-body)]">
                        <Layers
                          aria-hidden
                          className="size-3.5 shrink-0 text-[var(--accent-cta)]"
                        />
                        <span className="truncate">{name}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--text-muted)]">
                        {fmt(f.count)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </section>

      {/* ======= SEO-TEXT + CTA ======= */}
      <section className="rd-fade-up rd-fade-up-delay-3 grid grid-cols-1 gap-5 rounded-3xl border border-[var(--accent-cta)]/25 bg-[var(--surface-warm)] p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--accent-cta-ink)]">
            Om sidan
          </p>
          <h3 className="text-lg font-semibold text-[var(--text-strong)] sm:text-xl">
            Lokal hantverkskatalog för {kommun.name} kommun
          </h3>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-body)]">
            Här hittar du{" "}
            <span className="font-semibold tabular-nums text-[var(--text-strong)]">
              {fmt(liveTotal)}
            </span>{" "}
            registrerade hantverksföretag i {kommun.name}. Klicka på en
            kategori för att se alla företag inom den nischen, eller använd
            sökfunktionen för att hitta ett specifikt företag.
          </p>
        </div>
        <Link
          href={`/sok?kommun=${kommun.slug}`}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full rd-brand-gradient rd-cta-shadow px-5 text-sm font-semibold text-white transition hover:brightness-105 active:scale-[0.99]"
        >
          Sök i {kommun.name}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </section>
    </div>
  );
}
