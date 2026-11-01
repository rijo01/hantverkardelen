import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ALL_KOMMUNER, kommunBySlug } from "@/lib/kommuner";
import { lanByCode } from "@/lib/lan";
import { getBranschName, getBranschNamesBulk } from "@/lib/branscher";
import { yrkesnamn } from "@/lib/yrkesnamn";
import { KOMMUN_BRANSCH_FORETAG } from "@/lib/seo-snapshot";
import {
  branschPageSlug,
  listForetagInKommunByBransch,
  parseBranschSlug,
} from "@/lib/queries";
import { isHantverkBransch } from "@/lib/hantverk-branscher";
import { JsonLd, buildBreadcrumb } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
import { CompanyCard, CompanyCardList } from "@/components/company-card";
import { LankLista, ResultatVy, Sidbyte } from "@/components/resultat-vy";
import { loadAktivaOverlays, overlayFor } from "@/lib/overlay";
import { ordnaBoostade } from "@/lib/overlay-rankning";
import {
  hubIsIndexable,
  robotsFor,
  snapshotKommunBranschCount,
} from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";
const fmt = (n: number) => n.toLocaleString("sv-SE");

type Params = Promise<{ slug: string; bransch: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, bransch } = await params;
  const kommun = kommunBySlug(slug);
  const ng1 = parseBranschSlug(bransch);
  if (!kommun || !ng1) return { title: "Sida hittades inte" };
  const name = (await getBranschName(ng1)) ?? `SNI ${ng1}`;
  const title = `${name} i ${kommun.name}`;
  const description = `Hantverksföretag inom ${name.toLowerCase()} i ${kommun.name} kommun. Hitta lokala bygg-, el-, VVS- och hantverksföretag, kontaktuppgifter och adresser.`;
  // Kanonisk URL byggs ur branschnamnet, inte ur inkommande slug. Routen
  // matchar på det avslutande id:t, så /kommun/x/vadsomhelst-43210 svarade
  // 200 och pekade canonical på sig själv — obegränsat med dubbletter av
  // samma sida. Nu pekar alla varianter på en och samma adress.
  const canonicalSlug = branschPageSlug(name, ng1);
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/kommun/${kommun.slug}/${canonicalSlug}`,
    },
    openGraph: { title, description, type: "website", locale: "sv_SE" },
    // Grind 1, se lib/seo.ts.
    robots: robotsFor(
      hubIsIndexable(snapshotKommunBranschCount(kommun.code, ng1)),
    ),
  };
}

const PAGE_SIZE = 25;

/**
 * Kommun × yrke — hela sidan, för sida 1 (page.tsx) och sida 2+
 * (sida/[sida]/page.tsx).
 *
 * Sidan läser INTE searchParams. Det gjorde den förut (?page och storleks-
 * filtret), och då blev varje anrop en serverrendering: `private, no-store`,
 * 1,1–1,2 s, mätt 2026-11-01. Publika adresser är oförändrade: next.config.ts
 * skriver om `?page=N` till den interna vägen /sida/N, som är ISR precis som
 * sida 1. Storleksfiltret är borttaget (se lib/storleksklass.ts).
 */
export default async function BranschSida({
  slug,
  bransch,
  sida,
}: {
  slug: string;
  bransch: string;
  sida: number;
}) {
  const kommun = kommunBySlug(slug);
  const ng1 = parseBranschSlug(bransch);
  if (!kommun || !ng1) notFound();
  // Hard-guard: bransch-id måste tillhöra hantverks-nischen — annars 404.
  if (!isHantverkBransch(ng1)) notFound();

  const branschName = (await getBranschName(ng1)) ?? `SNI ${ng1}`;

  // Samma dubblettproblem som på företagssidan: routen matchar på det
  // avslutande branschid:t, så /kommun/x/vadsomhelst-43210 svarade 200.
  // 308 till kanonisk slug, med sidnumret i behåll — alltid i den publika
  // formen ?page=N, aldrig den interna /sida/N.
  const canonicalBransch = branschPageSlug(branschName, ng1);
  const page = sida;
  if (bransch !== canonicalBransch) {
    permanentRedirect(`/kommun/${kommun.slug}/${canonicalBransch}${page > 1 ? `?page=${page}` : ""}`);
  }

  // Databasen sorterar `poang desc, aeant desc, cfarnr asc`. Overlay-lagret
  // läggs ovanpå den ordningen, inte i stället för den: sorteringen är stabil,
  // så ett företag utan featured/list_priority hamnar exakt där det hade
  // hamnat utan overlay. Räckvidden är sidan — se ordnaBoostade().
  const [{ rows: oboostade, hasMore }, overlays] = await Promise.all([
    listForetagInKommunByBransch(kommun.code, ng1, {
      page,
      pageSize: PAGE_SIZE,
    }),
    loadAktivaOverlays(),
  ]);
  const rows = ordnaBoostade(oboostade, overlays);

  const antal = snapshotKommunBranschCount(kommun.code, ng1);
  const yrke = yrkesnamn(ng1, branschName);
  const lan = lanByCode(kommun.lan);
  const genitiv = kommun.name.endsWith("s") ? kommun.name : `${kommun.name}s`;

  // Samma yrke i länets andra kommuner, och andra yrken i samma kommun. Båda
  // ur snapshoten, och bara sidor som passerar indexgrinden — en intern länk
  // till en noindex-sida är en återvändsgränd för både besökare och Google.
  const grannar = ALL_KOMMUNER.filter(
    (k) => k.lan === kommun.lan && k.code !== kommun.code,
  )
    .map((k) => ({ k, n: snapshotKommunBranschCount(k.code, ng1) }))
    .filter(({ n }) => hubIsIndexable(n))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);
  const andraKoder = Object.entries(KOMMUN_BRANSCH_FORETAG[kommun.code] ?? {})
    .map(([kod, n]) => ({ ng1: Number(kod), n }))
    .filter((r) => r.ng1 !== ng1 && hubIsIndexable(r.n))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);
  const andraNamn = await getBranschNamesBulk(andraKoder.map((r) => r.ng1));

  const breadcrumbItems = [
    { name: "Hantverkardelen", href: "/" },
    { name: kommun.name, href: `/kommun/${kommun.slug}` },
    { name: branschName, href: `/kommun/${kommun.slug}/${bransch}` },
  ];

  const breadcrumbJsonLd = buildBreadcrumb([
    { name: "Hantverkardelen", url: SITE_URL },
    { name: kommun.name, url: `${SITE_URL}/kommun/${kommun.slug}` },
    {
      name: branschName,
      url: `${SITE_URL}/kommun/${kommun.slug}/${bransch}`,
    },
  ]);

  const basePath = `/kommun/${kommun.slug}/${bransch}`;
  /** Publik adress för en sida i listan: sida 1 utan parameter, annars ?page=N. */
  const sidaHref = (n: number) => (n > 1 ? `${basePath}?page=${n}` : basePath);

  const andraYrken = andraKoder.flatMap((r) => {
    const registerNamn = andraNamn.get(String(r.ng1)) ?? null;
    if (!registerNamn) return [];
    return [
      {
        href: `/kommun/${kommun.slug}/${branschPageSlug(registerNamn, r.ng1)}`,
        label: yrkesnamn(r.ng1, registerNamn),
        antal: r.n,
      },
    ];
  });

  return (
    <div className="sg-wrap pb-16">
      <JsonLd data={breadcrumbJsonLd} />
      <Breadcrumb items={breadcrumbItems} />

      <ResultatVy
        rubrik={`${branschName} i ${kommun.name}`}
        antal={antal > 0 ? `${fmt(antal)} företag` : ""}
        ingress={
          <p>
            Registrerade företag inom {yrke.toLowerCase()} i {genitiv} kommun
            {lan ? <>, {lan.name}s län</> : null}. Telefon och adress står direkt i listan.
          </p>
        }
        sidospalt={{
          under: (
            <>
              {lan && (
                <LankLista
                  rubrik={`${yrke} i närheten`}
                  lankar={grannar.map(({ k, n }) => ({
                    href: `/kommun/${k.slug}/${canonicalBransch}`,
                    label: k.name,
                    antal: n,
                  }))}
                />
              )}
              <LankLista
                rubrik={`Andra yrken i ${kommun.name}`}
                lankar={andraYrken}
                sist={{ href: `/kommun/${kommun.slug}`, label: `Alla hantverkare i ${kommun.name}` }}
              />
              <p className="px-1 text-[15px]">
                <Link href={`/sok?q=${encodeURIComponent(branschName)}`} className="sg-link inline-flex min-h-11 items-center">
                  {yrke} i hela Sverige
                </Link>
              </p>
            </>
          ),
        }}
      >
        {/* Plats för "Begär offert" till flera företag i orten, när
            offertflödet finns. Ligger här, ovanför listan, och aldrig
            i stället för numren. */}
        {rows.length === 0 ? (
          <div className="sg-panel p-6 sm:p-8">
            <p className="text-xl font-extrabold tracking-[-0.02em] text-ink">
              Inga företag på den här sidan
            </p>
            <Link href={basePath} className="sg-btn sg-btn-outline mt-4">
              Till första sidan
            </Link>
          </div>
        ) : (
          <CompanyCardList komplettaFinns={rows.some((f) => (f.poang ?? 0) > 0)}>
            {rows.map((f) => (
              <li key={f.id}>
                <CompanyCard
                  foretag={f}
                  overlay={overlayFor(f, overlays)}
                  branschName={yrke}
                  kommunName={kommun.name}
                />
              </li>
            ))}
          </CompanyCardList>
        )}

        <Sidbyte
          sida={page}
          foregaende={page > 1 ? sidaHref(page - 1) : null}
          nasta={hasMore ? sidaHref(page + 1) : null}
        />
      </ResultatVy>
    </div>
  );
}
