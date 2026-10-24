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
    <div className="sg-wrap space-y-8 pb-16">
      <JsonLd data={breadcrumbJsonLd} />
      <div>
        <Breadcrumb items={breadcrumbItems} />
        <header className="max-w-3xl space-y-3 border-b border-line pb-6">
          <h1 className="sg-display text-balance text-[2.125rem] sm:text-[2.75rem]">
            Hantverkare efter yrke
          </h1>
          <p className="text-[17px] leading-relaxed text-ink-2">
            {fmt(TOTAL_FORETAG)} registrerade hantverksföretag. Välj ett yrke för att
            se företagen i hela Sverige, eller sök på yrke och ort.
          </p>
        </header>
      </div>

      <section aria-labelledby="yrken" className="space-y-3">
        <h2 id="yrken" className="sg-label">
          Yrken
        </h2>
        <ul className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2">
          {HANTVERK_KATEGORIER.slice()
            .sort((a, b) => b.count - a.count)
            .map((k) => (
              <li key={k.slug} className="bg-white">
                <Link
                  href={`/sok?kategori=${k.slug}`}
                  className="group flex min-h-[4.5rem] items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-page"
                >
                  <span className="min-w-0">
                    <span className="block text-[20px] font-bold leading-tight text-ink group-hover:underline group-hover:underline-offset-4">
                      {kategoriNamn(k.slug)}
                    </span>
                    <span className="mt-0.5 block text-[15px] text-ink-2">{k.description}</span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink-3">
                    {fmt(k.count)}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="branscher" className="space-y-3">
        <h2 id="branscher" className="sg-label">
          Största branscherna i registret
        </h2>
        <ul className="flex flex-wrap gap-2">
          {TOP_BRANSCHER.map((b) => (
            <li key={b.id}>
              <Link
                href={`/sok?q=${encodeURIComponent(b.name)}`}
                className="inline-flex min-h-11 items-center gap-2 border border-line bg-white px-3.5 text-[15px] font-semibold text-ink transition-colors hover:border-navy hover:text-navy"
              >
                {yrkesnamn(b.id, b.name)}
                <span className="font-medium tabular-nums text-ink-3">{fmt(b.count)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
