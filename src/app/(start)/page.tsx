import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { JsonLd } from "@/components/json-ld";
import { TOTAL_KOMMUNER } from "@/lib/stats";
import { REGISTER_AR } from "@/lib/dataprovenans";
import { HANTVERK_KATEGORIER } from "@/lib/hantverk-kategorier";
import { kategoriNamn } from "@/lib/sokfraga";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";

/**
 * Startsidan är en sökyta. Besökaren kommer med en fråga — "elektriker i
 * Kungälv" — och ska kunna ställa den i första skärmen. Under heron finns
 * yrkena och tre raka besked om vad katalogen är.
 *
 * Inga totalsiffror och inget "hela registret" (beslut 2026-11-01): registret
 * är från omkring 2011, och ett antal företag eller ett löfte om fullständighet
 * säger något datat inte kan stå för. Tillbaka först när källan är färsk.
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
        {/* Mobil (360 px): sökformuläret ska börja inom ~220 px och
            yrkesindexet synas direkt under. Därför kort rubrik och en rad
            ingress; registrets ålder står kvar, bara inte som egen rad. */}
        <div className="sg-wrap pb-6 pt-4 sm:pb-20 sm:pt-14">
          <p className="hidden text-[13px] font-bold uppercase tracking-[0.06em] text-signal tabular-nums sm:block">
            {TOTAL_KOMMUNER} kommuner · register från omkring {REGISTER_AR}
          </p>
          <h1
            id="hero-title"
            className="max-w-4xl text-balance text-[1.75rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:mt-4 sm:text-[4rem] sm:leading-[1.02]"
          >
            Hitta hantverkare i hela Sverige
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-snug text-[var(--sg-on-navy-muted)] sm:mt-5 sm:text-xl sm:leading-relaxed">
            Elektriker, VVS, snickare och fler i {TOTAL_KOMMUNER} kommuner. Register från omkring {REGISTER_AR}
            <span className="hidden sm:inline">; inga offertformulär</span>.
          </p>
          <div className="mt-4 max-w-5xl sm:mt-8">
            <SearchBar variant="dual" snabbval />
          </div>
        </div>
      </section>

      <div className="bg-white">
        <section aria-labelledby="valj-yrke" className="sg-wrap pb-14 pt-5 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="valj-yrke" className="sg-display text-[1.375rem] sm:text-[2.5rem]">
              Välj yrke
            </h2>
            <Link href="/branscher" className="sg-link inline-flex min-h-11 items-center text-[15px]">
              Alla {yrken.length} yrken
            </Link>
          </div>
          {/* 1px-linjer mellan cellerna: rutnätets bakgrund syns i glappen. */}
          <ul className="mt-3 grid grid-cols-2 gap-px border border-line bg-line sm:mt-6 lg:grid-cols-3">
            {yrken.slice(0, 12).map((kat) => (
              <li key={kat.slug} className="bg-white">
                <Link
                  href={`/sok?kategori=${kat.slug}`}
                  className="group flex min-h-12 items-center justify-between gap-4 px-3 py-2.5 transition-colors hover:bg-page sm:min-h-[4.5rem] sm:px-5 sm:py-4"
                >
                  <span className="text-[16px] font-semibold leading-tight text-ink group-hover:underline group-hover:underline-offset-4 sm:text-[20px] sm:font-bold sm:tracking-[-0.01em]">
                    {kategoriNamn(kat.slug)}
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
    rubrik: "Ärligt om åldern",
    text: `Uppgifterna kommer från ett register från omkring ${REGISTER_AR}, och det står på varje sida.`,
  },
  {
    rubrik: "Ring direkt",
    text: "Har företaget lämnat ett nummer står det direkt i listan och på företagets sida. Inga formulär, ingen mellanhand.",
  },
  {
    rubrik: "Öppen ordning",
    text: "Företag med betald profil visas först, och under varje lista står hur den är sorterad.",
  },
];
