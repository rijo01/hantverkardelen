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
import { LankLista, ResultatVy, Sidbyte, StorlekVal } from "@/components/resultat-vy";
import { loadAktivaOverlays, overlayFor } from "@/lib/overlay";
import { ordnaBoostade } from "@/lib/overlay-rankning";
import {
  hubIsIndexable,
  robotsFor,
  snapshotKommunBranschCount,
} from "@/lib/seo";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";
const fmt = (n: number) => n.toLocaleString("sv-SE");

type Params = Promise<{ slug: string; bransch: string }>;
type Search = Promise<{ page?: string; aeantMin?: string; aeantMax?: string }>;

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

const SIZE_BUCKETS: Array<{ label: string; min?: number; max?: number }> = [
  { label: "Alla" },
  { label: "1–9", min: 1, max: 9 },
  { label: "10–49", min: 10, max: 49 },
  { label: "50–249", min: 50, max: 249 },
  { label: "250+", min: 250 },
];

export default async function BranschPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug, bransch } = await params;
  const sp = await searchParams;
  const kommun = kommunBySlug(slug);
  const ng1 = parseBranschSlug(bransch);
  if (!kommun || !ng1) notFound();
  // Hard-guard: bransch-id måste tillhöra hantverks-nischen — annars 404.
  if (!isHantverkBransch(ng1)) notFound();

  const branschName = (await getBranschName(ng1)) ?? `SNI ${ng1}`;

  // Samma dubblettproblem som på företagssidan: routen matchar på det
  // avslutande branschid:t, så /kommun/x/vadsomhelst-43210 svarade 200.
  // 301 till kanonisk slug, med sökparametrarna i behåll så att paginering
  // och storleksfilter överlever omdirigeringen.
  const canonicalBransch = branschPageSlug(branschName, ng1);
  if (bransch !== canonicalBransch) {
    const qs = new URLSearchParams();
    for (const [k, v] of [
      ["page", sp.page],
      ["aeantMin", sp.aeantMin],
      ["aeantMax", sp.aeantMax],
    ] as const) {
      if (v) qs.set(k, v);
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    permanentRedirect(`/kommun/${kommun.slug}/${canonicalBransch}${suffix}`);
  }

  const page = Math.max(1, Number(sp.page) || 1);
  const aeantMin = sp.aeantMin ? Number(sp.aeantMin) : undefined;
  const aeantMax = sp.aeantMax ? Number(sp.aeantMax) : undefined;

  // Databasen sorterar `poang desc, aeant desc, cfarnr asc`. Overlay-lagret
  // läggs ovanpå den ordningen, inte i stället för den: sorteringen är stabil,
  // så ett företag utan featured/list_priority hamnar exakt där det hade
  // hamnat utan overlay. Räckvidden är sidan — se ordnaBoostade().
  const [{ rows: oboostade, hasMore }, overlays] = await Promise.all([
    listForetagInKommunByBransch(kommun.code, ng1, {
      page,
      pageSize: PAGE_SIZE,
      aeantMin,
      aeantMax,
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
  function withParams(overrides: Record<string, string | null>): string {
    const merged: Record<string, string | undefined> = {
      page: sp.page,
      aeantMin: sp.aeantMin,
      aeantMax: sp.aeantMax,
    };
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) merged[k] = undefined;
      else merged[k] = v;
    }
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

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
          overst: (
            <StorlekVal
              val={SIZE_BUCKETS.map((b) => ({
                label: b.label,
                href: withParams({
                  aeantMin: b.min ? String(b.min) : null,
                  aeantMax: b.max ? String(b.max) : null,
                  page: null,
                }),
                aktiv:
                  (aeantMin ?? null) === (b.min ?? null) &&
                  (aeantMax ?? null) === (b.max ?? null),
              }))}
            />
          ),
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
              Inga företag i den storleken
            </p>
            <p className="mt-1 text-[15px] text-ink-2">
              Inga registrerade företag inom {yrke.toLowerCase()} i {kommun.name} har
              så många anställda.
            </p>
            <Link
              href={withParams({ aeantMin: null, aeantMax: null, page: null })}
              className="sg-btn sg-btn-outline mt-4"
            >
              Visa alla storlekar
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
          foregaende={page > 1 ? withParams({ page: page > 2 ? String(page - 1) : null }) : null}
          nasta={hasMore ? withParams({ page: String(page + 1) }) : null}
        />
      </ResultatVy>
    </div>
  );
}
