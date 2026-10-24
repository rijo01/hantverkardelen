import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { JsonLd } from "@/components/json-ld";
import { TOTAL_FORETAG, TOTAL_KOMMUNER } from "@/lib/stats";
import { HANTVERK_KATEGORIER } from "@/lib/hantverk-kategorier";
import { kategoriNamn } from "@/lib/sokfraga";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";

const fmt = (n: number) => n.toLocaleString("sv-SE");

/**
 * Startsidan är en sökyta. Besökaren kommer med en fråga — "elektriker i
 * Kungälv" — och ska kunna ställa den i första skärmen. Under heron finns
 * yrkena och tre raka besked om vad katalogen är. Alla tal räknas ur
 * registret (stats.ts, hantverk-kategorier.ts), inga är avrundade eller
 * påhittade.
 */
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

  const yrken = [...HANTVERK_KATEGORIER].sort((a, b) => b.count - a.count);

  return (
    <>
      <JsonLd data={webSiteJsonLd} />

      {/* Heron fortsätter sidhuvudets navy utan skarv. */}
      <section aria-labelledby="hero-title" className="sg-on-navy bg-navy text-white">
        <div className="sg-wrap pb-14 pt-8 sm:pb-20 sm:pt-14">
          <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-signal tabular-nums">
            {fmt(TOTAL_FORETAG)} hantverksföretag · {TOTAL_KOMMUNER} kommuner
          </p>
          <h1
            id="hero-title"
            className="mt-4 max-w-4xl text-balance text-[2.625rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-white sm:text-[4rem]"
          >
            Hitta rätt hantverkare. Ring direkt.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--sg-on-navy-muted)] sm:text-xl">
            Hela Sveriges register över elektriker, målare, snickare, VVS- och
            byggfirmor. Inga offertformulär, inga köpta betyg.
          </p>
          <div className="mt-8 max-w-5xl">
            <SearchBar variant="dual" snabbval />
          </div>
        </div>
      </section>

      <div className="bg-white">
        <section aria-labelledby="valj-yrke" className="sg-wrap py-14 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="valj-yrke" className="sg-display text-[2rem] sm:text-[2.5rem]">
              Välj yrke
            </h2>
            <Link href="/branscher" className="sg-link inline-flex min-h-11 items-center text-[15px]">
              Alla {yrken.length} yrken
            </Link>
          </div>
          {/* 1px-linjer mellan cellerna: rutnätets bakgrund syns i glappen. */}
          <ul className="mt-6 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {yrken.slice(0, 12).map((kat) => (
              <li key={kat.slug} className="bg-white">
                <Link
                  href={`/sok?kategori=${kat.slug}`}
                  className="group flex min-h-[4.5rem] items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-page"
                >
                  <span className="text-[20px] font-bold leading-tight tracking-[-0.01em] text-ink group-hover:underline group-hover:underline-offset-4">
                    {kategoriNamn(kat.slug)}
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink-3">
                    {fmt(kat.count)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="sa-funkar-det"
          aria-labelledby="sa-funkar-det-rubrik"
          className="scroll-mt-4 border-t border-line"
        >
          <div className="sg-wrap py-14 sm:py-20">
            <h2 id="sa-funkar-det-rubrik" className="sg-label">
              Så funkar det
            </h2>
            <dl className="mt-6 grid gap-8 md:grid-cols-3 md:gap-10">
              {LOFTEN.map((l) => (
                <div key={l.rubrik} className="border-t-4 border-signal pt-5">
                  <dt className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">
                    {l.rubrik}
                  </dt>
                  <dd className="mt-2 text-[16px] leading-relaxed text-ink-2">{l.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </div>
    </>
  );
}

const LOFTEN = [
  {
    rubrik: "Hela registret",
    text: "Alla registrerade hantverksföretag finns med, inte bara de som betalar för att synas.",
  },
  {
    rubrik: "Ring direkt",
    text: "Numret syns direkt i listan och på företagets sida. Inga formulär, ingen mellanhand.",
  },
  {
    rubrik: "Ärligt märkt",
    text: "Inga köpta betyg. Företag som betalar för att synas först är märkta som annons.",
  },
];
