import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Building2, MapPin, Layers } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { JsonLd } from "@/components/json-ld";
import { TOTAL_FORETAG, TOTAL_KOMMUNER, TOTAL_BRANSCHER } from "@/lib/stats";
import { HANTVERK_KATEGORIER } from "@/lib/hantverk-kategorier";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";

const POPULAR_SEARCHES = [
  { label: "Elektriker", href: "/sok?kategori=el" },
  { label: "VVS & Rör", href: "/sok?kategori=vvs" },
  { label: "Målare", href: "/sok?kategori=maleri" },
  { label: "Snickare", href: "/sok?kategori=snickeri" },
  { label: "Byggföretag", href: "/sok?kategori=bygg" },
  { label: "Takläggare", href: "/sok?kategori=tak" },
  { label: "Golv", href: "/sok?kategori=golv" },
];

const fmt = (n: number) => n.toLocaleString("sv-SE");

export default function HomePage() {
  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Hantverkardelen",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/sok?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="rd-full-bleed space-y-0 overflow-x-hidden">
      <JsonLd data={webSiteJsonLd} />

      {/* =========== HJÄLTE =========== */}
      <section
        aria-labelledby="hero-title"
        className="relative overflow-hidden px-4 pt-12 pb-16 sm:pt-20 sm:pb-24"
      >
        {/* Subtilt varmt ljus uppifrån + blå glow från sidorna */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(242,116,12,0.08), transparent 65%),"
              + "radial-gradient(ellipse 40% 35% at 0% 30%, rgba(10,77,140,0.07), transparent 70%),"
              + "radial-gradient(ellipse 40% 35% at 100% 30%, rgba(10,77,140,0.05), transparent 70%),"
              + "linear-gradient(180deg, #ffffff 0%, #ffffff 100%)",
          }}
        />

        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
          <h1
            id="hero-title"
            className="rd-fade-up text-balance text-[2.25rem] font-bold leading-[1.05] tracking-tight text-[var(--text-strong)] sm:text-5xl md:text-6xl"
          >
            Hitta rätt{" "}
            <span className="text-[var(--accent-cta)]">hantverkare</span>
            <br className="hidden sm:block" /> i hela Sverige
          </h1>

          <p className="rd-fade-up rd-fade-up-delay-1 mx-auto max-w-2xl text-balance text-base text-[var(--text-muted)] sm:text-lg">
            Sök bland tusentals företag inom bygg, el, VVS, måleri, snickeri,
            tak, golv och städ — i alla 290 kommuner.
          </p>

          {/* Dual-sökruta */}
          <div className="rd-fade-up rd-fade-up-delay-2 w-full">
            <div className="flex justify-center">
              <Suspense fallback={null}>
                <SearchBar variant="dual" />
              </Suspense>
            </div>
          </div>

          {/* Populära kategorier */}
          <div className="rd-fade-up rd-fade-up-delay-3 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-[var(--text-dim)]">Populärt:</span>
            {POPULAR_SEARCHES.map((term) => (
              <Link
                key={term.label}
                href={term.href}
                className="rounded-full border border-[var(--rule)] bg-white px-3 py-1 text-[var(--text-body)] transition hover:border-[var(--accent-cta)]/45 hover:bg-[var(--surface-warm)] hover:text-[var(--accent-cta-ink)]"
              >
                {term.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* =========== STATISTIK-RUTOR =========== */}
      <section className="px-4 pb-12 sm:pb-16">
        <div className="mx-auto max-w-5xl">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              value={fmt(TOTAL_FORETAG)}
              label="Hantverksföretag i katalogen"
              icon={<Building2 aria-hidden className="size-5" />}
            />
            <StatTile
              value={fmt(TOTAL_KOMMUNER)}
              label="Kommuner med hantverkare"
              icon={<MapPin aria-hidden className="size-5" />}
            />
            <StatTile
              value={fmt(TOTAL_BRANSCHER)}
              label="Hantverkskategorier (SNI-koder)"
              icon={<Layers aria-hidden className="size-5" />}
            />
          </ul>
        </div>
      </section>

      {/* =========== KATEGORI-SEKTION =========== */}
      <section
        aria-labelledby="kategori-title"
        className="bg-[var(--surface-soft)] px-4 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="space-y-3 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--brand)]">
              Kategorier
            </p>
            <h2
              id="kategori-title"
              className="text-balance text-3xl font-bold tracking-tight text-[var(--text-strong)] sm:text-4xl"
            >
              Sök hantverkare efter typ
            </h2>
            <p className="mx-auto max-w-xl text-[var(--text-muted)]">
              {HANTVERK_KATEGORIER.length} kategorier baserade på SCB:s
              SNI-koder — klicka för att se alla företag inom området.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HANTVERK_KATEGORIER.map((kat) => {
              const Icon = kat.icon;
              return (
                <li key={kat.slug}>
                  <Link
                    href={`/sok?kategori=${kat.slug}`}
                    className="group relative flex h-full items-start gap-4 rounded-2xl border border-[var(--rule)] bg-white p-6 transition hover:border-[var(--brand)]/40 hover:shadow-[0_8px_24px_-12px_rgba(10,77,140,0.18)]"
                  >
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--tint-2)] text-[var(--brand)] ring-1 ring-[var(--brand)]/15 transition group-hover:bg-[var(--brand)] group-hover:text-white group-hover:ring-[var(--brand)]/40">
                      <Icon className="size-6" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-[17px] font-semibold tracking-tight text-[var(--text-strong)] group-hover:text-[var(--brand-ink)]">
                        {kat.name}
                      </h3>
                      <p className="text-sm leading-snug text-[var(--text-muted)]">
                        {kat.description}
                      </p>
                      <p className="pt-1.5 font-mono text-xs tabular-nums text-[var(--text-dim)]">
                        {fmt(kat.count)} företag
                      </p>
                    </div>
                    <ArrowRight
                      aria-hidden
                      className="mt-1 size-4 shrink-0 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-cta)]"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}

function StatTile({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-4 rounded-2xl border border-[var(--rule)] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--tint-2)] text-[var(--brand)] ring-1 ring-[var(--brand)]/15">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-mono text-2xl font-bold tabular-nums tracking-tight text-[var(--text-strong)] sm:text-3xl">
          {value}
        </p>
        <p className="mt-0.5 text-[13px] leading-snug text-[var(--text-muted)]">
          {label}
        </p>
      </div>
    </li>
  );
}
