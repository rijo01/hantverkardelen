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
    <div className="space-y-12 pb-8">
      <JsonLd data={breadcrumbJsonLd} />
      <Breadcrumb items={breadcrumbItems} />

      <header className="max-w-3xl space-y-3">
        <h1 className="rd-serif text-balance text-[2.5rem] text-[var(--text-strong)] sm:text-[3.5rem]">
          Hantverkare i alla {TOTAL_KOMMUNER} kommuner
        </h1>
        <p className="text-lg leading-relaxed text-[var(--text-muted)]">
          {fmt(TOTAL_FORETAG)} registrerade hantverksföretag i {TOTAL_LAN} län.
          Välj din kommun för att se yrkena där.
        </p>
      </header>

      <section aria-labelledby="flest" className="space-y-4">
        <h2 id="flest" className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
          Flest hantverkare
        </h2>
        <ul className="grid grid-cols-2 border-t border-[var(--rule)] sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4">
          {TOP_KOMMUNER.slice(0, 12).map((k) => (
            <li key={k.kommun.code} className="border-b border-[var(--rule)]">
              <Link
                href={k.href}
                className="group flex min-h-12 items-center justify-between gap-2 py-2.5 pr-2"
              >
                <span className="truncate font-medium text-[var(--text-strong)] underline-offset-4 group-hover:text-[var(--brand-ink)] group-hover:underline">
                  {k.kommun.name}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-[var(--text-muted)]">
                  {fmt(k.count)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="alla" aria-labelledby="alla-kommuner" className="space-y-4">
        <h2 id="alla-kommuner" className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
          Alla kommuner A–Ö
        </h2>
        <div className="divide-y divide-[var(--rule-soft)] border-y border-[var(--rule)]">
          {Array.from(groups.entries()).map(([letter, kommuner]) => (
            <div key={letter} className="grid grid-cols-[2.5rem_1fr] items-start gap-3 py-3">
              <h3 className="rd-serif text-3xl text-[var(--brand)]">{letter}</h3>
              <ul className="flex flex-wrap gap-x-4 gap-y-0.5">
                {kommuner.map((k) => (
                  <li key={k.code}>
                    <Link
                      href={`/kommun/${k.slug}`}
                      className="inline-flex min-h-9 items-center text-[15px] text-[var(--text-body)] underline-offset-4 transition-colors hover:text-[var(--brand-ink)] hover:underline"
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
