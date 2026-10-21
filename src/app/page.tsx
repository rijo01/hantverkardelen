import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { JsonLd } from "@/components/json-ld";
import { TOTAL_FORETAG, TOTAL_KOMMUNER, TOP_KOMMUNER } from "@/lib/stats";
import { HANTVERK_KATEGORIER } from "@/lib/hantverk-kategorier";
import { kategoriNamn } from "@/lib/sokfraga";
import { REGISTER_AR } from "@/lib/dataprovenans";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";

const fmt = (n: number) => n.toLocaleString("sv-SE");

/**
 * Startsidan är en sökyta. Besökaren kommer med en fråga — "elektriker i
 * Kungälv" — och ska kunna ställa den i första skärmen. Under sökrutan finns
 * bara vägar vidare (yrken, orter) och fyra raka besked om vad katalogen är.
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
  const orter = TOP_KOMMUNER.slice(0, 16);

  return (
    <div className="space-y-16 pb-8 sm:space-y-20">
      <JsonLd data={webSiteJsonLd} />

      <section aria-labelledby="hero-title" className="max-w-4xl pt-10 sm:pt-16">
        <h1
          id="hero-title"
          className="rd-serif text-balance text-[2.75rem] text-[var(--text-strong)] sm:text-6xl"
        >
          Hitta en hantverkare i din kommun
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--text-muted)]">
          {fmt(TOTAL_FORETAG)} registrerade hantverksföretag i Sveriges{" "}
          {TOTAL_KOMMUNER} kommuner. Telefon och adress syns direkt, utan
          offertformulär.
        </p>
        <div className="mt-8">
          <SearchBar variant="dual" snabbval />
        </div>
      </section>

      <section className="grid gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16">
        <div>
          <h2 className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
            Alla yrken
          </h2>
          <ul className="mt-5 grid grid-cols-1 border-t border-[var(--rule)] sm:grid-cols-2 sm:gap-x-8">
            {yrken.map((kat) => (
              <li key={kat.slug} className="border-b border-[var(--rule)]">
                <Link
                  href={`/sok?kategori=${kat.slug}`}
                  className="group flex min-h-12 items-baseline justify-between gap-3 py-3"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-[var(--text-strong)] underline-offset-4 group-hover:text-[var(--brand-ink)] group-hover:underline">
                      {kategoriNamn(kat.slug)}
                    </span>
                    <span className="block text-sm text-[var(--text-muted)]">
                      {kat.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-[var(--text-muted)]">
                    {fmt(kat.count)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
            Största orterna
          </h2>
          <ul className="mt-5 grid grid-cols-2 border-t border-[var(--rule)] sm:gap-x-8">
            {orter.map((o) => (
              <li key={o.kommun.code} className="border-b border-[var(--rule)]">
                <Link
                  href={o.href}
                  className="group flex min-h-12 items-center justify-between gap-2 py-2.5 pr-2"
                >
                  <span className="truncate font-medium text-[var(--text-strong)] underline-offset-4 group-hover:text-[var(--brand-ink)] group-hover:underline">
                    {o.kommun.name}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-[var(--text-muted)]">
                    {fmt(o.count)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/kommuner"
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--brand-ink)] underline underline-offset-4 decoration-[var(--brand)]/30 hover:decoration-[var(--brand)]"
          >
            Alla {TOTAL_KOMMUNER} kommuner
          </Link>
        </div>
      </section>

      <section aria-labelledby="om-katalogen" className="border-t border-[var(--rule)] pt-10">
        <h2 id="om-katalogen" className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
          Så fungerar katalogen
        </h2>
        <dl className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-semibold text-[var(--text-strong)]">Hela registret</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-[var(--text-muted)]">
              Alla hantverksföretag i registret finns med, inte bara de som
              betalar för att synas.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--text-strong)]">Inga betyg</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-[var(--text-muted)]">
              Vi visar inga stjärnor eller omdömen som vi inte kan stå för. Det
              du ser är registerfakta.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--text-strong)]">Utvald är en annons</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-[var(--text-muted)]">
              Företag kan betala för att synas först i listorna. De märks alltid
              &ldquo;Utvald · annons&rdquo;.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--text-strong)]">Uppgifter från {REGISTER_AR}</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-[var(--text-muted)]">
              Telefonnummer och adresser kommer från ett register från omkring{" "}
              {REGISTER_AR}. Kontrollera dem innan du åker dit.
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-[var(--surface-soft)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">
            Driver du ett hantverksföretag?
          </h2>
          <p className="mt-1 max-w-xl text-[15px] text-[var(--text-muted)]">
            Rätta dina uppgifter, eller lägg till logotyp, beskrivning och
            tjänster så att kunderna hittar rätt nummer.
          </p>
        </div>
        <Link
          href="/kontakt"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-[var(--brand)]/35 bg-white px-4 font-semibold text-[var(--brand-ink)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--tint-1)]"
        >
          Uppdatera ditt företag
        </Link>
      </section>
    </div>
  );
}
