import type { Metadata } from "next";
import Link from "next/link";
import { ALL_KOMMUNER } from "@/lib/kommuner";
import { TOP_KOMMUNER, TOTAL_KOMMUNER, TOTAL_LAN, TOTAL_FORETAG } from "@/lib/stats";
import { JsonLd, buildBreadcrumb } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";
const fmt = (n: number) => n.toLocaleString("sv-SE");

export const metadata: Metadata = {
  title: `Hantverkare i alla ${TOTAL_KOMMUNER} kommuner`,
  description: `Bläddra bland Sveriges ${TOTAL_KOMMUNER} kommuner i ${TOTAL_LAN} län. Hitta lokala hantverksföretag — elektriker, VVS, snickare, målare, byggföretag — för varje kommun.`,
  alternates: { canonical: `${SITE_URL}/kommuner` },
};

export default function KommunerPage() {
  const sorted = [...ALL_KOMMUNER].sort((a, b) =>
    a.name.localeCompare(b.name, "sv"),
  );
  const groups = new Map<string, typeof sorted>();
  for (const k of sorted) {
    const letter = k.name[0]?.toUpperCase() ?? "?";
    const arr = groups.get(letter);
    if (arr) arr.push(k);
    else groups.set(letter, [k]);
  }

  const breadcrumbItems = [
    { name: "Hantverkardelen", href: "/" },
    { name: "Kommuner" },
  ];
  const breadcrumbJsonLd = buildBreadcrumb([
    { name: "Hantverkardelen", url: SITE_URL },
    { name: "Kommuner", url: `${SITE_URL}/kommuner` },
  ]);

  return (
    <div className="sg-wrap space-y-8 pb-16">
      <JsonLd data={breadcrumbJsonLd} />
      <div>
        <Breadcrumb items={breadcrumbItems} />
        <header className="max-w-3xl space-y-3 border-b border-line pb-6">
          <h1 className="sg-display text-balance text-[2.125rem] sm:text-[2.75rem]">
            Hantverkare i alla {TOTAL_KOMMUNER} kommuner
          </h1>
          <p className="text-[17px] leading-relaxed text-ink-2">
            {fmt(TOTAL_FORETAG)} registrerade hantverksföretag i {TOTAL_LAN} län.
            Välj din kommun för att se yrkena där.
          </p>
        </header>
      </div>

      <section aria-labelledby="flest" className="space-y-3">
        <h2 id="flest" className="sg-label">
          Flest hantverkare
        </h2>
        <ul className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {TOP_KOMMUNER.slice(0, 12).map((k) => (
            <li key={k.kommun.code} className="bg-white">
              <Link
                href={k.href}
                className="group flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-page"
              >
                <span className="truncate text-[18px] font-bold text-ink group-hover:underline group-hover:underline-offset-4">
                  {k.kommun.name}
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink-3">
                  {fmt(k.count)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="alla" aria-labelledby="alla-kommuner" className="space-y-3">
        <h2 id="alla-kommuner" className="sg-label">
          Alla kommuner A–Ö
        </h2>
        <div className="sg-panel divide-y divide-line-soft px-4 sm:px-6">
          {Array.from(groups.entries()).map(([letter, kommuner]) => (
            <div key={letter} className="grid grid-cols-[2.25rem_1fr] items-start gap-3 py-3">
              <h3 className="pt-1 text-2xl font-extrabold leading-none text-navy">{letter}</h3>
              <ul className="flex flex-wrap gap-x-4 gap-y-0.5">
                {kommuner.map((k) => (
                  <li key={k.code}>
                    <Link
                      href={`/kommun/${k.slug}`}
                      className="inline-flex min-h-9 items-center text-[15px] text-ink-2 underline-offset-4 transition-colors hover:text-navy hover:underline"
                      title={`Hantverkare i ${k.name} kommun`}
                    >
                      {k.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
