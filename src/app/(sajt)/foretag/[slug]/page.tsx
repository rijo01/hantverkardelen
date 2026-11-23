import ForetagSida from "./ForetagSida";

/**
 * Den publika företagssidan. ISR, precis som förut.
 *
 * Allt innehåll ligger i ForetagSida så att förhandsvisningsrouten kan
 * återanvända det. Den här filen finns kvar för routesegmentets konfiguration
 * och för `generateMetadata` — båda gäller bara i en page-fil.
 *
 * Sidan läser MEDVETET inte searchParams. Katalogen har tiotusentals
 * företagssidor; hade den gjort det vore varje sidvisning en serverrendering,
 * och ISR hade varit borta för hela sajten. Förhandsvisningen har därför en
 * egen adress som betalar det priset ensam.
 */
export const revalidate = 86400;

export { generateMetadata } from "./ForetagSida";

/**
 * Tom lista: ingen företagssida byggs i förväg, men routen blir ISR — varje
 * sida renderas vid första anropet och cachas i ett dygn. Utan
 * generateStaticParams var varje anrop `private, no-store` (1,1–1,2 s,
 * mätt 2026-11-01), trots `revalidate` ovan.
 */
export function generateStaticParams() {
  return [];
}

export default async function ForetagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ForetagSida slug={slug} />;
}
