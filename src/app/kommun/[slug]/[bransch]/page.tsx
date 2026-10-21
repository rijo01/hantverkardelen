import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
  { label: "Alla storlekar" },
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

  return (
    <div className="space-y-10 pb-8">
      <JsonLd data={breadcrumbJsonLd} />
      <Breadcrumb items={breadcrumbItems} />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-3">
          <h1 className="rd-serif text-balance text-[2.5rem] text-[var(--text-strong)] sm:text-[3.5rem]">
            {branschName} i {kommun.name}
          </h1>
          <p className="text-lg leading-relaxed text-[var(--text-muted)]">
            {antal > 0 ? (
              <>
                <span className="font-semibold tabular-nums text-[var(--text-strong)]">
                  {fmt(antal)}
                </span>{" "}
                registrerade företag inom {yrke.toLowerCase()} i {genitiv} kommun
                {lan ? <>, {lan.name}s län</> : null}.
              </>
            ) : (
              <>Registrerade företag inom {yrke.toLowerCase()} i {genitiv} kommun.</>
            )}{" "}
            Telefon och adress står direkt i listan.
          </p>
        </div>
        {/* Plats för "Begär offert" till flera företag i orten, när
            offertflödet finns. Ligger här, bredvid rubriken, och aldrig
            framför listan. */}
      </header>

      <nav aria-label="Filtrera på storlek" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-[var(--text-muted)]">Antal anställda:</span>
        {SIZE_BUCKETS.map((b) => {
          const isActive =
            (aeantMin ?? null) === (b.min ?? null) &&
            (aeantMax ?? null) === (b.max ?? null);
          return (
            <Link
              key={b.label}
              href={withParams({
                aeantMin: b.min ? String(b.min) : null,
                aeantMax: b.max ? String(b.max) : null,
                page: null,
              })}
              aria-current={isActive ? "true" : undefined}
              className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
                isActive
                  ? "border-[var(--brand)] bg-[var(--tint-2)] text-[var(--brand-ink)]"
                  : "border-[var(--rule)] bg-white text-[var(--text-body)] hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)]"
              }`}
            >
              {b.label}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--rule)] bg-white p-6 sm:p-8">
          <p className="text-lg font-semibold text-[var(--text-strong)]">
            Inga företag i den storleken
          </p>
          <p className="mt-1 text-[15px] text-[var(--text-muted)]">
            Inga registrerade företag inom {yrke.toLowerCase()} i {kommun.name} har
            så många anställda.
          </p>
          <Link
            href={withParams({ aeantMin: null, aeantMax: null, page: null })}
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--brand-ink)] underline underline-offset-4"
          >
            Visa alla storlekar
          </Link>
        </div>
      ) : (
        <CompanyCardList>
          {rows.map((f) => (
            <li key={f.id}>
              <CompanyCard
                foretag={f}
                overlay={overlayFor(f, overlays)}
                kommunName={kommun.name}
              />
            </li>
          ))}
        </CompanyCardList>
      )}

      {(page > 1 || hasMore) && (
        <nav aria-label="Sidor" className="flex items-center justify-between border-t border-[var(--rule)] pt-5 text-sm">
          {page > 1 ? (
            <Link
              href={withParams({ page: page > 2 ? String(page - 1) : null })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--rule)] bg-white px-4 font-medium text-[var(--text-body)] transition hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)] hover:text-[var(--brand-ink)]"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Föregående
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[var(--text-muted)]">Sida {page}</span>
          {hasMore ? (
            <Link
              href={withParams({ page: String(page + 1) })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--rule)] bg-white px-4 font-medium text-[var(--text-body)] transition hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)] hover:text-[var(--brand-ink)]"
            >
              Nästa
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {grannar.length > 0 && lan && (
        <section aria-labelledby="grannar">
          <h2 id="grannar" className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
            {yrke} i närliggande kommuner
          </h2>
          <p className="mt-1 text-[15px] text-[var(--text-muted)]">
            Övriga kommuner i {lan.name}s län.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {grannar.map(({ k, n }) => (
              <li key={k.code}>
                <Link
                  href={`/kommun/${k.slug}/${canonicalBransch}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--rule)] bg-white px-3 text-sm font-medium text-[var(--text-body)] transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)] hover:text-[var(--brand-ink)]"
                >
                  {k.name}
                  <span className="tabular-nums text-[var(--text-muted)]">{fmt(n)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {andraKoder.length > 0 && (
        <section aria-labelledby="andra-yrken">
          <h2 id="andra-yrken" className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
            Andra yrken i {kommun.name}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {andraKoder.map((r) => {
              const registerNamn = andraNamn.get(String(r.ng1)) ?? null;
              if (!registerNamn) return null;
              return (
                <li key={r.ng1}>
                  <Link
                    href={`/kommun/${kommun.slug}/${branschPageSlug(registerNamn, r.ng1)}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--rule)] bg-white px-3 text-sm font-medium text-[var(--text-body)] transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)] hover:text-[var(--brand-ink)]"
                  >
                    {yrkesnamn(r.ng1, registerNamn)}
                    <span className="tabular-nums text-[var(--text-muted)]">{fmt(r.n)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
            <Link
              href={`/kommun/${kommun.slug}`}
              className="inline-flex min-h-11 items-center font-semibold text-[var(--brand-ink)] underline underline-offset-4 decoration-[var(--brand)]/30 hover:decoration-[var(--brand)]"
            >
              Alla hantverkare i {kommun.name}
            </Link>
            <Link
              href={`/sok?q=${encodeURIComponent(branschName)}`}
              className="inline-flex min-h-11 items-center font-semibold text-[var(--brand-ink)] underline underline-offset-4 decoration-[var(--brand)]/30 hover:decoration-[var(--brand)]"
            >
              {yrke} i hela Sverige
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
