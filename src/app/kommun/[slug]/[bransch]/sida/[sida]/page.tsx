import { notFound, permanentRedirect } from "next/navigation";
import BranschSida from "../../BranschSida";

/**
 * Kommun × yrke, sida 2 och framåt — INTERN väg. Besökare och Google ser
 * /kommun/x/y?page=N; next.config.ts skriver om den hit så att sidan kan vara
 * ISR utan att läsa searchParams.
 *
 * Metadata är densamma som sida 1 (canonical → sida 1, samma robots) — precis
 * som ?page=N betedde sig före omskrivningen. Pagineringens SEO ska samordnas
 * över klustret och ändras inte här.
 */
export const revalidate = 86400;

export { generateMetadata } from "../../BranschSida";

/** Inga sidor byggs i förväg; de renderas vid första anropet och cachas. */
export function generateStaticParams() {
  return [];
}

export default async function BranschSidaN({
  params,
}: {
  params: Promise<{ slug: string; bransch: string; sida: string }>;
}) {
  const { slug, bransch, sida } = await params;
  if (!/^\d{1,4}$/.test(sida)) notFound();
  const n = Number(sida);
  if (n < 1) notFound();
  // Sida 1 har bara en adress.
  if (n === 1) permanentRedirect(`/kommun/${slug}/${bransch}`);
  return <BranschSida slug={slug} bransch={bransch} sida={n} />;
}
