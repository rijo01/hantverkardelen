import { sidhuvudetsLogotyp } from "@/lib/overlay-contract";
import type { Metadata } from "next";
import { visatTelefon as visatTelefonFor } from "@/lib/visat-telefon";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ExternalLink, Globe, Mail, MapPin, User } from "lucide-react";
import { kommunByCode } from "@/lib/kommuner";
import {
  branschPageSlug,
  foretagSlug,
  getForetagByCfarnr,
  listRelatedForetag,
  listSokordForCfarnr,
  parseCfarnrFromSlug,
  type Foretag,
} from "@/lib/queries";
import { getBranschName } from "@/lib/branscher";
import { JsonLd, buildBreadcrumb } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
import {
  CompanyCard,
  CompanyCardList,
  RingKnapp,
  ProfilEtikett,
} from "@/components/company-card";
import { MobilRingrad } from "@/components/mobil-ringrad";
import { yrkesnamn } from "@/lib/yrkesnamn";
import {
  displayName,
  employerSize,
  googleMapsUrl,
  profilMarkning,
  legalFormFor,
  normalizeWebb,
  orgnrDisplay,
  shortWebb,
} from "@/lib/foretag-format";
import { isPersonalOrgnr } from "@/lib/jurform";
import {
  PERSONUPPGIFT_FORKLARING,
  REGISTER_AR,
  REGISTER_FORKLARING,
} from "@/lib/dataprovenans";
import { sanitizeInfotext, safeLogotypUrl } from "@/lib/sanitize-html";
import {
  getOverlayForForetag,
  getOverlayUtkastForForetag,
  loadAktivaOverlays,
  overlayFor,
} from "@/lib/overlay";
import { overlayGerSubstans, ordnaBoostade } from "@/lib/overlay-rankning";
import SponsradProfil from "@/components/sponsrad-profil";
import { foretagIsIndexable, robotsFor } from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const cfarnr = parseCfarnrFromSlug(slug);
  if (!cfarnr) return { title: "Företag hittades inte" };
  const f = await getForetagByCfarnr(cfarnr);
  if (!f) return { title: "Företag hittades inte" };
  const name = displayName(f);
  const kommun = f.kommun ? kommunByCode(f.kommun) : null;
  const title = kommun ? `${name} – ${kommun.name}` : name;
  const description = `${name}${
    kommun ? ` i ${kommun.name} kommun` : ""
  }${f.gatuadress ? `, ${f.gatuadress}` : ""}. Kontaktuppgifter, bransch och företagsinformation från offentliga register.`;
  return {
    title,
    description,
    // Kanonisk URL byggs ur företagsnamnet, inte ur inkommande slug: routen
    // matchar bara på det avslutande cfarnr, så /foretag/vadsomhelst-12345
    // svarade 200 och satte canonical på sig själv. Varje felstavning blev
    // en egen indexerbar dubblett. Nu pekar alla varianter på samma adress.
    alternates: { canonical: `${SITE_URL}/foretag/${foretagSlug(f)}` },
    openGraph: { title, description, type: "website", locale: "sv_SE" },
    // Grind 2, se lib/seo.ts — en företagssida utan substans utöver
    // registerraden ska inte indexeras.
    //
    // En OVERLAY-KUND passerar grinden även när registerraden är naken. Utan
    // det här skulle en såld och publicerad profil kunna ligga kvar som
    // noindex: kunden har betalat för synlighet i Google och fått en sida som
    // uttryckligen ber Google att inte visa den. Uppslaget är cachat, så det
    // delar rundtur med sidan nedan.
    robots: robotsFor(
      foretagIsIndexable(f) || overlayGerSubstans(await getOverlayForForetag(f)),
    ),
  };
}

/**
 * Företagssidans hela innehåll.
 *
 * Bruten ur page.tsx för att förhandsvisningen ska kunna återanvända den.
 * Den publika sidan är ISR (revalidate 86400) för tiotusentals företag, och
 * hade den läst searchParams själv för att hitta `?preview=` hade varenda
 * sidvisning blivit en serverrendering. Nu betalar bara förhandsvisningen det
 * priset — se forhandsvisning/page.tsx.
 */
export default async function ForetagSida({
  slug,
  /** Satt ENDAST från förhandsvisningsrouten. Publik rendering skickar aldrig med den. */
  previewToken,
}: {
  slug: string;
  previewToken?: string;
}) {
  const cfarnr = parseCfarnrFromSlug(slug);
  if (!cfarnr) notFound();
  // getForetagByCfarnr filtrerar mot HANTVERK_BRANSCHER — företag utanför
  // nischen returnerar null och route:n får 404 (samma pattern som vårddelen).
  const f = await getForetagByCfarnr(cfarnr);
  if (!f) notFound();

  // Routen matchar bara på det avslutande cfarnr, så varje påhittad slug med
  // rätt id svarade 200 — obegränsat med dubbletter av samma sida. Skicka
  // 301 till den kanoniska adressen istället för att bara peka canonical dit.
  // foretagSlug() är deterministisk och slutar alltid på "-{cfarnr}", så
  // omdirigeringen kan inte loopa.
  // Förhandsvisningen har en egen adress och en egen slug-form; en
  // omdirigering här hade kastat säljaren till den publika sidan.
  const canonicalSlug = foretagSlug(f);
  if (!previewToken && slug !== canonicalSlug) {
    permanentRedirect(`/foretag/${canonicalSlug}`);
  }

  const kommun = f.kommun ? kommunByCode(f.kommun) : null;
  const branschName = f.ng1 ? await getBranschName(f.ng1) : null;
  const name = displayName(f);
  const legalForm = legalFormFor(f);
  const size = employerSize(f.aeant);
  const mapsUrl = googleMapsUrl(f);
  const webb = normalizeWebb(f.webb);
  const orgnrInfo = orgnrDisplay(f);
  const sanitizedInfotext = sanitizeInfotext(f.infotext);
  const personalOrgnr = isPersonalOrgnr(f.jurform);

  // Overlay: den betalda profilen. I förhandsvisning läses UTKASTET i stället
  // för den publicerade raden — samma rendering, annan källa, så att säljaren
  // ser exakt vad kunden kommer att se.
  const [oboostadeRelated, sokord, overlay, overlays] = await Promise.all([
    kommun && f.ng1
      ? listRelatedForetag(kommun.code, f.ng1, f.cfarnr, 6)
      : Promise.resolve([] as Foretag[]),
    listSokordForCfarnr(f.cfarnr),
    previewToken
      ? getOverlayUtkastForForetag(f, previewToken)
      : getOverlayForForetag(f),
    loadAktivaOverlays(),
  ]);

  // "Liknande företag" är också en lista, och en betald placering gäller där
  // precis som i sök och i kommunlistan.
  const related = ordnaBoostade(oboostadeRelated, overlays);

  // Ett utkast som inte finns, eller en token som inte håller, ger ingen sida
  // alls i förhandsvisningsläget. Att i stället visa den publika sidan hade
  // gjort förhandsvisningen till en självkanonikaliserande dubblett.
  if (previewToken && !overlay) notFound();

  // SIDHUVUDETS LOGOTYP: den köpta före registrets. Regeln är kontraktets
  // sidhuvudetsLogotyp() — samma på alla tre klustersajter. Förut visades bara
  // registrets bild här, och en köpt logotyp syntes först i det sponsrade
  // kortet längre ner. `overlay` är utkastet bakom en förhandsvisning.
  const logoUrl = sidhuvudetsLogotyp(overlay, safeLogotypUrl(f.logotyp))?.url ?? null;

  // "Utvald · annons" bara för ett aktuellt overlay-köp (featured); registrets
  // gamla poang får "Komplett profil". Se profilMarkning().
  const markning = profilMarkning(f, overlay);

  /**
   * Vilket telefonnummer sidan visar i huvudet.
   *
   * `dolj_andra_nummer` är kundens köpta rätt att ersätta registrets nummer med
   * sitt eget — men bara NÄR DE FAKTISKT LÄMNAT ETT. Utan den spärren hade en
   * kund som kryssat i rutan och sedan tömt sitt nummerfält fått en sida helt
   * utan telefonnummer, vilket är motsatsen till vad de betalade för.
   *
   * Är rutan inte ikryssad visas registrets nummer i huvudet och kundens eget i
   * profilkortet — två nummer som båda är sanna, var och en märkt med varifrån
   * den kommer.
   */
  const visatTelefon = visatTelefonFor(f.tel, overlay);

  /**
   * Sökorden i strukturerad data.
   *
   * Kundens egna ord (overlay `keywords` och `kategorier`) läggs FÖRE
   * registrets `sokordtable`-ord, och dubbletter faller bort skiftlägesokänsligt
   * — registret skriver "BERGSPRÄNGNING" där kunden skrivit "Bergsprängning",
   * och två varianter av samma ord i knowsAbout är brus, inte innehåll.
   */
  const strukturSokord = slaIhopSokord(
    [...(overlay?.kategorier ?? []), ...(overlay?.keywords ?? [])],
    sokord,
  );

  const breadcrumbItems = [
    { name: "Hantverkardelen", href: "/" },
    ...(kommun ? [{ name: kommun.name, href: `/kommun/${kommun.slug}` }] : []),
    ...(kommun && branschName && f.ng1
      ? [
          {
            name: branschName,
            href: `/kommun/${kommun.slug}/${branschPageSlug(branschName, f.ng1)}`,
          },
        ]
      : []),
    { name },
  ];

  const breadcrumbJsonLd = buildBreadcrumb(
    breadcrumbItems
      .filter((b) => b.href)
      .map((b) => ({ name: b.name, url: `${SITE_URL}${b.href!}` }))
      .concat([{ name, url: `${SITE_URL}/foretag/${slug}` }]),
  );

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    ...(f.gatuadress || f.postort
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: f.gatuadress ?? undefined,
            postalCode: f.postnr ? String(f.postnr) : undefined,
            addressLocality: f.postort ?? kommun?.name,
            addressCountry: "SE",
          },
        }
      : {}),
    ...(visatTelefon ? { telephone: visatTelefon } : {}),
    ...(webb ? { url: webb } : {}),
    ...(f.epostadress ? { email: f.epostadress } : {}),
    ...(f.aeant ? { numberOfEmployees: f.aeant } : {}),
    ...(strukturSokord.length > 0
      ? {
          keywords: strukturSokord.join(", "),
          knowsAbout: strukturSokord.slice(0, 30),
        }
      : {}),
  };

  const faqItems = buildFaq({ name, branschName, kommun: kommun?.name ?? null, f, telefon: visatTelefon });
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  const description = buildDescription({
    name,
    branschName,
    kommun: kommun?.name ?? null,
    f,
    legalForm,
  });

  return (
    <div className="space-y-12 pb-8">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={faqJsonLd} />
      <Breadcrumb items={breadcrumbItems} />

      {/* ========= HUVUD + KONTAKT =========
          Besökaren kom hit för att få tag på företaget. Numret, adressen och
          vägarna dit står därför direkt under namnet — inte två kort längre
          ner som förut. */}
      <header className="space-y-5">
        <div className="flex items-start gap-4">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${name} logotyp`}
              loading="lazy"
              className="size-16 shrink-0 rounded-lg border border-[var(--rule)] bg-white object-contain p-1.5 sm:size-20"
            />
          )}
          <div className="min-w-0 space-y-2">
            {(markning || legalForm) && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
                <ProfilEtikett markning={markning} />
                {legalForm && <span>{legalForm}</span>}
              </div>
            )}
            <h1 className="rd-serif text-balance break-words text-[2.25rem] text-[var(--text-strong)] sm:text-5xl">
              {name}
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-[var(--text-muted)]">
              {branschName && f.ng1 && kommun ? (
                <Link
                  href={`/kommun/${kommun.slug}/${branschPageSlug(branschName, f.ng1)}`}
                  className="font-semibold text-[var(--brand-ink)] underline-offset-4 hover:underline"
                >
                  {yrkesnamn(f.ng1, branschName)}
                </Link>
              ) : branschName ? (
                <span className="font-semibold text-[var(--text-body)]">{branschName}</span>
              ) : null}
              {kommun && (
                <>
                  <span aria-hidden className="text-[var(--text-faint)]">·</span>
                  <Link
                    href={`/kommun/${kommun.slug}`}
                    className="underline-offset-4 hover:text-[var(--brand-ink)] hover:underline"
                  >
                    {kommun.name} kommun
                  </Link>
                </>
              )}
              {size && (
                <>
                  <span aria-hidden className="text-[var(--text-faint)]">·</span>
                  <span>{size.label}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div
          id="kontakt"
          className="grid gap-5 rounded-xl border border-[var(--rule)] bg-white p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-6"
        >
          <div className="space-y-3">
            {visatTelefon ? (
              <>
                <RingKnapp telefon={visatTelefon} name={name} stor className="flex w-full justify-center sm:inline-flex sm:w-auto" />
                <p className="text-sm text-[var(--text-muted)]">
                  {overlay?.telefon_override && visatTelefon === overlay.telefon_override.trim()
                    ? "Numret är lämnat av företaget."
                    : `Numret kommer från ett register från ${REGISTER_AR} och kan vara inaktuellt.`}
                </p>
              </>
            ) : (
              <p className="text-[15px] text-[var(--text-muted)]">
                Registret har inget telefonnummer till {name}.
              </p>
            )}
            {(f.epostadress || webb) && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-[15px]">
                {f.epostadress && (
                  <a
                    href={`mailto:${f.epostadress}`}
                    className="inline-flex min-h-11 items-center gap-2 font-medium text-[var(--brand-ink)] underline-offset-4 hover:underline"
                  >
                    <Mail className="size-4 shrink-0" aria-hidden />
                    {f.epostadress}
                  </a>
                )}
                {webb && (
                  <a
                    href={webb}
                    target="_blank"
                    rel="nofollow noopener"
                    className="inline-flex min-h-11 items-center gap-2 font-medium text-[var(--brand-ink)] underline-offset-4 hover:underline"
                  >
                    <Globe className="size-4 shrink-0" aria-hidden />
                    {shortWebb(webb)}
                  </a>
                )}
              </div>
            )}
            {/* Plats för "Begär offert" när offertflödet finns — under
                numret, som ett andra sätt att nå företaget. */}
          </div>

          <div className="border-t border-[var(--rule-soft)] pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <h2 className="text-sm font-semibold text-[var(--text-strong)]">Adress</h2>
            {f.gatuadress || f.postort ? (
              <address className="mt-1 not-italic text-[15px] leading-relaxed text-[var(--text-body)]">
                {f.gatuadress && <span className="block">{f.gatuadress}</span>}
                <span className="block">
                  {[f.postnr, f.postort].filter(Boolean).join(" ")}
                </span>
              </address>
            ) : (
              <p className="mt-1 text-[15px] text-[var(--text-muted)]">Ingen adress registrerad.</p>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="nofollow noopener"
                className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-medium text-[var(--brand-ink)] underline-offset-4 hover:underline"
              >
                <MapPin className="size-4 shrink-0" aria-hidden />
                Visa på karta
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        </div>
      </header>

      {visatTelefon && <MobilRingrad telefon={visatTelefon} namn={name} ankareId="kontakt" />}

      {/* ========= BETALD PROFIL (overlay) =========
          Direkt under kontakten och ÖVER registerbeskrivningen: det kunden
          själv skrivit om sin verksamhet är mer värt för besökaren än en
          registerrad från 2011. Renderas bara när det finns en aktiv och giltig
          overlay-rad — eller, i förhandsvisning, ett utkast. */}
      {overlay && (
        <SponsradProfil overlay={overlay} namn={name} utkast={Boolean(previewToken)} />
      )}

      {/* ========= OM + REGISTERFAKTA ========= */}
      <section className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h2 className="rd-serif text-3xl text-[var(--text-strong)]">Om {name}</h2>
          {sanitizedInfotext ? (
            <div
              className="rd-rich-text mt-3 max-w-prose text-[15px] leading-relaxed text-[var(--text-body)]"
              dangerouslySetInnerHTML={{ __html: sanitizedInfotext }}
            />
          ) : (
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-[var(--text-body)]">
              {description}
            </p>
          )}
          {f.kontaktperson && (
            <p className="mt-4 inline-flex items-center gap-2 text-[15px] text-[var(--text-body)]">
              <User className="size-4 text-[var(--text-dim)]" aria-hidden />
              Kontaktperson: <span className="font-medium text-[var(--text-strong)]">{f.kontaktperson}</span>
            </p>
          )}
          {sokord.length > 0 && (
            <>
              <h3 className="mt-7 text-sm font-semibold text-[var(--text-strong)]">
                Tjänster och sökord
              </h3>
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {sokord.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/sok?q=${encodeURIComponent(s)}`}
                      className="inline-flex min-h-9 items-center rounded-md border border-[var(--rule)] bg-white px-2.5 text-sm text-[var(--text-body)] transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)] hover:text-[var(--brand-ink)]"
                      title={`Sök ${s}`}
                    >
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {branschName && (
            <p className="mt-7 flex flex-wrap gap-x-6 gap-y-1 text-[15px]">
              {kommun && f.ng1 && (
                <Link
                  href={`/kommun/${kommun.slug}/${branschPageSlug(branschName, f.ng1)}`}
                  className="inline-flex min-h-11 items-center font-semibold text-[var(--brand-ink)] underline underline-offset-4 decoration-[var(--brand)]/30 hover:decoration-[var(--brand)]"
                >
                  Fler inom {yrkesnamn(f.ng1, branschName).toLowerCase()} i {kommun.name}
                </Link>
              )}
              <Link
                href={`/sok?q=${encodeURIComponent(branschName)}`}
                className="inline-flex min-h-11 items-center font-semibold text-[var(--brand-ink)] underline underline-offset-4 decoration-[var(--brand)]/30 hover:decoration-[var(--brand)]"
              >
                {branschName} i hela Sverige
              </Link>
            </p>
          )}
        </div>

        <div>
          <h2 className="rd-serif text-3xl text-[var(--text-strong)]">Registerfakta</h2>
          <dl className="mt-3 divide-y divide-[var(--rule-soft)] border-y border-[var(--rule-soft)]">
            <InfoRow
              label="Organisationsnummer"
              value={
                orgnrInfo?.kind === "orgnr" ? (
                  <span className="tabular-nums">{orgnrInfo.value}</span>
                ) : orgnrInfo?.kind === "hidden" ? (
                  <span className="text-[var(--text-muted)]">{orgnrInfo.value}</span>
                ) : null
              }
            />
            <InfoRow label="Juridisk form" value={legalForm} />
            <InfoRow
              label="Antal anställda"
              value={size ? <span className="tabular-nums">{size.label}</span> : null}
            />
            <InfoRow
              label="Kommun"
              value={
                kommun ? (
                  <Link
                    href={`/kommun/${kommun.slug}`}
                    className="text-[var(--brand-ink)] underline-offset-4 hover:underline"
                  >
                    {kommun.name}
                  </Link>
                ) : null
              }
            />
            <InfoRow label="Postort" value={f.postort} />
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
            {personalOrgnr
              ? "Inget organisationsnummer visas — för en enskild firma är numret ett personnummer, och det hämtas aldrig ut ur databasen. "
              : ""}
            {PERSONUPPGIFT_FORKLARING} {REGISTER_FORKLARING}
          </p>
        </div>
      </section>

      {/* ========= LIKNANDE FÖRETAG ========= */}
      {related.length > 0 && kommun && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="rd-serif text-3xl text-[var(--text-strong)]">
              {branschName && f.ng1
                ? `Fler inom ${yrkesnamn(f.ng1, branschName).toLowerCase()} i ${kommun.name}`
                : `Fler hantverkare i ${kommun.name}`}
            </h2>
            <Link
              href={
                branschName && f.ng1
                  ? `/kommun/${kommun.slug}/${branschPageSlug(branschName, f.ng1)}`
                  : `/kommun/${kommun.slug}`
              }
              className="inline-flex min-h-11 shrink-0 items-center font-semibold text-[var(--brand-ink)] underline underline-offset-4 decoration-[var(--brand)]/30 hover:decoration-[var(--brand)]"
            >
              Visa alla
            </Link>
          </div>
          <CompanyCardList>
            {related.map((rf) => (
              <li key={rf.id}>
                <CompanyCard
                  foretag={rf}
                  overlay={overlayFor(rf, overlays)}
                  kommunName={kommun.name}
                />
              </li>
            ))}
          </CompanyCardList>
        </section>
      )}

      {/* ========= FAQ ========= */}
      <section className="space-y-4">
        <h2 className="rd-serif text-3xl text-[var(--text-strong)]">
          Frågor och svar om {name}
        </h2>
        <div className="divide-y divide-[var(--rule-soft)] rounded-xl border border-[var(--rule)] bg-white">
          {faqItems.map((it, i) => (
            <details
              key={i}
              className="group px-5 py-4 sm:px-6"
              {...(i === 0 ? { open: true } : {})}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-medium text-[var(--text-strong)]">
                {it.q}
                <span
                  aria-hidden
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-muted)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-[var(--text-muted)]">
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Hantverkarens väg in: rätta registret eller köp en profil. */}
      {!overlay && (
        <section className="flex flex-col gap-4 rounded-xl bg-[var(--surface-soft)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">
              Är det här ditt företag?
            </h2>
            <p className="mt-1 max-w-xl text-[15px] text-[var(--text-muted)]">
              Rätta numret och adressen, eller lägg till logotyp, beskrivning och
              tjänster.
            </p>
          </div>
          <Link
            href="/kontakt"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-[var(--brand)]/35 bg-white px-4 font-semibold text-[var(--brand-ink)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--tint-1)]"
          >
            Uppdatera uppgifterna
          </Link>
        </section>
      )}
    </div>
  );
}

type FaqItem = { q: string; a: string };

function buildDescription({
  name,
  branschName,
  kommun,
  f,
  legalForm,
}: {
  name: string;
  branschName: string | null;
  kommun: string | null;
  f: Foretag;
  legalForm: string | null;
}): string {
  const segs: string[] = [];
  segs.push(
    `${name} är ${legalForm ? `ett ${legalForm.toLowerCase()}` : "registrerat"}${
      branschName
        ? ` verksamt inom ${branschName.toLowerCase()}`
        : ""
    }${kommun ? ` i ${kommun} kommun` : ""}.`,
  );
  if (f.aeant && f.aeant > 0) {
    segs.push(
      f.aeant === 1
        ? "Företaget har 1 anställd enligt senast tillgängliga uppgifter."
        : `Företaget har ca ${f.aeant.toLocaleString("sv-SE")} anställda enligt senast tillgängliga uppgifter.`,
    );
  }
  if (f.gatuadress) {
    segs.push(
      `Besöksadress: ${f.gatuadress}${f.postort ? `, ${f.postort}` : ""}.`,
    );
  }
  return segs.join(" ");
}

function buildFaq({
  name,
  branschName,
  kommun,
  f,
  telefon,
}: {
  name: string;
  branschName: string | null;
  kommun: string | null;
  f: Foretag;
  /** Numret sidan visar — visatTelefon(), aldrig f.tel. FAQ:n hamnar också i JSON-LD. */
  telefon: string | null;
}): FaqItem[] {
  const items: FaqItem[] = [];

  if (f.gatuadress || f.postort || kommun) {
    const addr =
      [f.gatuadress, [f.postnr, f.postort].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ") || kommun || "Sverige";
    items.push({
      q: `Var ligger ${name}?`,
      a: `${name} finns på ${addr}${
        kommun && !f.postort ? ` i ${kommun} kommun` : ""
      }.`,
    });
  }

  if (branschName) {
    items.push({
      q: `Vad gör ${name}?`,
      a: `${name} är verksamt inom ${branschName.toLowerCase()}${
        kommun ? ` i ${kommun}` : ""
      }. För att se andra hantverksföretag i samma bransch kan du klicka på branschlänken ovan.`,
    });
  }

  if (telefon || f.epostadress || f.webb) {
    const ch: string[] = [];
    if (telefon) ch.push(`telefon ${telefon}`);
    if (f.epostadress) ch.push(`e-post ${f.epostadress}`);
    if (f.webb) ch.push(`hemsida ${f.webb}`);
    items.push({
      q: `Hur kontaktar jag ${name}?`,
      a: `Enligt registret når du ${name} via ${ch.join(", ")}. Uppgiften är ` +
        `hämtad från ett offentligt näringslivsregister från omkring ` +
        `${REGISTER_AR} och kan vara inaktuell.`,
    });
  } else {
    items.push({
      q: `Hur kontaktar jag ${name}?`,
      a: `Vi har inga publika kontaktuppgifter för ${name}. Uppgifterna kommer från ett register från omkring ${REGISTER_AR} och kan vara ofullständiga eller inaktuella.`,
    });
  }

  if (f.aeant) {
    items.push({
      q: `Hur många anställda har ${name}?`,
      a:
        f.aeant === 1
          ? `${name} har 1 anställd enligt senast tillgängliga data.`
          : `${name} har cirka ${f.aeant.toLocaleString("sv-SE")} anställda enligt senast tillgängliga data.`,
    });
  }

  if (f.arEnskildFirma) {
    items.push({
      q: `Vad är organisationsnumret för ${name}?`,
      a: `${name} är en enskild firma. Organisationsnumret är detsamma som ägarens personnummer och visas inte av integritetsskäl enligt GDPR.`,
    });
  } else if (f.orgnr) {
    items.push({
      q: `Vad är organisationsnumret för ${name}?`,
      a: `Organisationsnumret för ${name} är ${f.orgnr}. Uppgiften kommer från ett offentligt näringslivsregister från omkring ${REGISTER_AR}.`,
    });
  } else {
    items.push({
      q: `Vad är organisationsnumret för ${name}?`,
      a: `Organisationsnumret för ${name} är inte tillgängligt i vår källa just nu. Du kan kontrollera det via Bolagsverket eller Skatteverket.`,
    });
  }

  return items;
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="text-right text-[var(--text-strong)]">
        {value ?? <span className="text-[var(--text-muted)]">Uppgift saknas</span>}
      </dd>
    </div>
  );
}

/**
 * Slår ihop två sökordslistor utan dubbletter, med den första listans ordning
 * och stavning bevarad. Jämförelsen är skiftlägesokänslig och trimmad.
 */
function slaIhopSokord(forst: string[], sedan: string[]): string[] {
  const ut: string[] = [];
  const sedda = new Set<string>();
  for (const ord of [...forst, ...sedan]) {
    const rent = ord.trim();
    if (!rent) continue;
    const nyckel = rent.toLowerCase();
    if (sedda.has(nyckel)) continue;
    sedda.add(nyckel);
    ut.push(rent);
  }
  return ut;
}
