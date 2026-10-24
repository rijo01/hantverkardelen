import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ALL_KOMMUNER, kommunBySlug } from "@/lib/kommuner";
import { lanByCode } from "@/lib/lan";
import { yrkesnamn } from "@/lib/yrkesnamn";
import {
  branschPageSlug,
  countForetagInKommun,
  getBranschFordelning,
  listForetagInKommun,
} from "@/lib/queries";
import { getBranschNamesBulk } from "@/lib/branscher";
import { JsonLd, buildBreadcrumb } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
import { hubIsIndexable, robotsFor, snapshotKommunCount } from "@/lib/seo";
import { CompanyCard, CompanyCardList } from "@/components/company-card";
import { LankLista, ResultatVy } from "@/components/resultat-vy";
import { loadAktivaOverlays, overlayFor } from "@/lib/overlay";
import { ordnaBoostade } from "@/lib/overlay-rankning";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";
const fmt = (n: number) => n.toLocaleString("sv-SE");

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const kommun = kommunBySlug(slug);
  if (!kommun) return { title: "Kommun hittades inte" };
  const title = `Hantverkare i ${kommun.name} kommun`;
  const description = `Hem- & hantverkskatalog för ${kommun.name} kommun. Hitta elektriker, VVS, snickare, målare, byggföretag, takläggare och städ i ${kommun.name}.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/kommun/${kommun.slug}` },
    openGraph: { title, description, type: "website", locale: "sv_SE" },
    // Grind 1, se lib/seo.ts — en kommun med för få företag är en tunn sida.
    robots: robotsFor(hubIsIndexable(snapshotKommunCount(kommun.code))),
  };
}

export default async function KommunPage({ params }: { params: Params }) {
  const { slug } = await params;
  const kommun = kommunBySlug(slug);
  if (!kommun) notFound();

  // Exakt count vid render. Tidigare lästes ett förberäknat värde ur stats.ts
  // när det fanns — och just de värdena var 1001-artefakter från
  // count=estimated. Nu räknar vi alltid, det kostar ~350 ms en gång per dygn.
  const [liveTotal, fordelning, oboostadeForetag, overlays] = await Promise.all([
    countForetagInKommun(kommun.code),
    getBranschFordelning(kommun.code, 24),
    listForetagInKommun(kommun.code, 12),
    loadAktivaOverlays(),
  ]);

  // Overlay-vikten läggs ovanpå sajtens ordning (störst arbetsgivare först).
  // Stabil sortering: den som inte köpt framhävning står kvar där den stod.
  const foretagSample = ordnaBoostade(oboostadeForetag, overlays);

  const branschNames = await getBranschNamesBulk(fordelning.map((f) => f.ng1));

  const lan = lanByCode(kommun.lan);
  // Närliggande = samma län. Grannskapsdata finns inte; länet är det ärliga
  // närmevärdet. Bara kommuner vars sida passerar indexgrinden, så att
  // länkarna aldrig leder till en noindex-sida.
  const grannar = ALL_KOMMUNER.filter(
    (k) => k.lan === kommun.lan && k.code !== kommun.code,
  )
    .map((k) => ({ k, n: snapshotKommunCount(k.code) }))
    .filter(({ n }) => hubIsIndexable(n))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);

  const breadcrumbItems = [
    { name: "Hantverkardelen", href: "/" },
    { name: kommun.name, href: `/kommun/${kommun.slug}` },
  ];

  const breadcrumbJsonLd = buildBreadcrumb([
    { name: "Hantverkardelen", url: SITE_URL },
    { name: kommun.name, url: `${SITE_URL}/kommun/${kommun.slug}` },
  ]);

  const genitiv = kommun.name.endsWith("s") ? kommun.name : `${kommun.name}s`;

  const yrken = fordelning.map((f) => {
    const registerNamn = branschNames.get(String(f.ng1)) ?? null;
    const namn = yrkesnamn(f.ng1, registerNamn);
    return {
      href: `/kommun/${kommun.slug}/${branschPageSlug(registerNamn ?? namn, f.ng1)}`,
      label: namn,
      antal: f.count,
    };
  });

  return (
    <div className="sg-wrap pb-16">
      <JsonLd data={breadcrumbJsonLd} />
      <Breadcrumb items={breadcrumbItems} />

      <ResultatVy
        rubrik={`Hantverkare i ${kommun.name}`}
        antal={`${fmt(liveTotal)} företag`}
        ingress={
          <p>
            Registrerade hantverksföretag i {genitiv} kommun
            {lan ? <>, {lan.name}s län</> : null}. Välj ett yrke, eller sök i fältet överst.
          </p>
        }
        sidospalt={{
          under: (
            <>
              <LankLista rubrik={`Yrken i ${kommun.name}`} lankar={yrken} />
              {lan && (
                <LankLista
                  rubrik={`Fler kommuner i ${lan.name}s län`}
                  lankar={grannar.map(({ k, n }) => ({
                    href: `/kommun/${k.slug}`,
                    label: k.name,
                    antal: n,
                  }))}
                />
              )}
            </>
          ),
        }}
      >
        <h2 id="storst" className="sg-label">
          Flest anställda · de {foretagSample.length} största, alla yrken
        </h2>
        {foretagSample.length === 0 ? (
          <p className="sg-panel p-6 text-[15px] text-ink-2">
            Inga hantverksföretag registrerade i {kommun.name}.
          </p>
        ) : (
          <CompanyCardList komplettaFinns={foretagSample.some((f) => (f.poang ?? 0) > 0)}>
            {foretagSample.map((f) => (
              <li key={f.id}>
                <CompanyCard
                  foretag={f}
                  overlay={overlayFor(f, overlays)}
                  branschName={f.ng1 ? yrkesnamn(f.ng1) : null}
                  kommunName={kommun.name}
                />
              </li>
            ))}
          </CompanyCardList>
        )}
      </ResultatVy>
    </div>
  );
}
