import type { Metadata } from "next";
import Link from "next/link";
import { TOP_BRANSCHER, TOTAL_BRANSCHER, TOTAL_FORETAG } from "@/lib/stats";
import { HANTVERK_KATEGORIER } from "@/lib/hantverk-kategorier";
import { kategoriNamn } from "@/lib/sokfraga";
import { yrkesnamn } from "@/lib/yrkesnamn";
import { JsonLd, buildBreadcrumb } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";
const fmt = (n: number) => n.toLocaleString("sv-SE");

export const metadata: Metadata = {
  title: `Hantverkskategorier i Sverige`,
  description: `Bläddra bland ${TOTAL_BRANSCHER} hantverks- & byggkategorier. ${fmt(TOTAL_FORETAG)} registrerade hantverksföretag.`,
  alternates: { canonical: `${SITE_URL}/branscher` },
};

export default function BranscherPage() {
  const breadcrumbItems = [
    { name: "Hantverkardelen", href: "/" },
    { name: "Branscher" },
  ];
  const breadcrumbJsonLd = buildBreadcrumb([
    { name: "Hantverkardelen", url: SITE_URL },
    { name: "Branscher", url: `${SITE_URL}/branscher` },
  ]);

  return (
    <div className="space-y-12 pb-8">
      <JsonLd data={breadcrumbJsonLd} />
      <Breadcrumb items={breadcrumbItems} />

      <header className="max-w-3xl space-y-3">
        <h1 className="rd-serif text-balance text-[2.5rem] text-[var(--text-strong)] sm:text-[3.5rem]">
          Hantverkare efter yrke
        </h1>
        <p className="text-lg leading-relaxed text-[var(--text-muted)]">
          {fmt(TOTAL_FORETAG)} registrerade hantverksföretag. Välj ett yrke för att
          se företagen i hela Sverige, eller sök på yrke och ort.
        </p>
      </header>

      <section aria-labelledby="yrken" className="space-y-4">
        <h2 id="yrken" className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
          Yrken
        </h2>
        <ul className="grid grid-cols-1 border-t border-[var(--rule)] sm:grid-cols-2 sm:gap-x-8">
          {HANTVERK_KATEGORIER.slice()
            .sort((a, b) => b.count - a.count)
            .map((k) => (
              <li key={k.slug} className="border-b border-[var(--rule)]">
                <Link
                  href={`/sok?kategori=${k.slug}`}
                  className="group flex min-h-12 items-baseline justify-between gap-3 py-3"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-[var(--text-strong)] underline-offset-4 group-hover:text-[var(--brand-ink)] group-hover:underline">
                      {kategoriNamn(k.slug)}
                    </span>
                    <span className="block text-sm text-[var(--text-muted)]">{k.description}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-[var(--text-muted)]">
                    {fmt(k.count)}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="branscher" className="space-y-4">
        <h2 id="branscher" className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
          Största branscherna i registret
        </h2>
        <ul className="flex flex-wrap gap-2">
          {TOP_BRANSCHER.map((b) => (
            <li key={b.id}>
              <Link
                href={`/sok?q=${encodeURIComponent(b.name)}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--rule)] bg-white px-3 text-sm font-medium text-[var(--text-body)] transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)] hover:text-[var(--brand-ink)]"
              >
                {yrkesnamn(b.id, b.name)}
                <span className="tabular-nums text-[var(--text-muted)]">{fmt(b.count)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
