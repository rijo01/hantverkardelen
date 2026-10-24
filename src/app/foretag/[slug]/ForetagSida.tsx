import { logoMatt, sidhuvudetsLogotyp } from "@/lib/overlay-contract";
import type { Metadata } from "next";
import { visatTelefon as visatTelefonFor } from "@/lib/visat-telefon";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { kommunByCode } from "@/lib/kommuner";
import { lanByCode } from "@/lib/lan";
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
import { KomplettEtikett, RingKnapp } from "@/components/company-card";
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
import {
  KontaktRuta,
  OmMarkningen,
  UtkastBanner,
  betaldProfil,
} from "@/components/sponsrad-profil";
import { foretagIsIndexable, robotsFor, snapshotKommunBranschCount } from "@/lib/seo";

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

  // "Fler i orten" är också en lista, och en betald placering gäller där
  // precis som i sök och i kommunlistan. Sidospalten visar de tre första.
  const related = ordnaBoostade(oboostadeRelated, overlays).slice(0, 3);

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

  // ── Visningsläge ──
  // BETALT när det finns en aktiv overlay-rad (eller, i förhandsvisning, ett
  // utkast): allt kunden lämnat visas, märkt som betalt. Annars registret —
  // med registrets gamla poang som en neutral "Komplett profil".
  const profil = overlay ? betaldProfil(overlay) : null;
  const lan = kommun ? lanByCode(kommun.lan) : null;
  const yrke = f.ng1 ? yrkesnamn(f.ng1, branschName) : branschName;
  const yrkeHref =
    kommun && branschName && f.ng1
      ? `/kommun/${kommun.slug}/${branschPageSlug(branschName, f.ng1)}`
      : null;
  const omrade = kommun ? [kommun.name, lan ? `${lan.name}s län` : null].filter(Boolean).join(", ") : null;
  const undertitel = profil
    ? [profil.tjanster[0] ?? yrke, kommun?.name].filter(Boolean).join(" · ")
    : null;
  const nyckeltal = [legalForm, size?.label].filter(Boolean);
  const hemsida = profil?.hemsida ?? webb;
  const epost = profil?.epost ?? f.epostadress;
  const egetNummer = Boolean(
    overlay?.telefon_override && visatTelefon === overlay.telefon_override.trim(),
  );
  const logoStorlek = profil ? "size-20 sm:size-[112px]" : "size-16 sm:size-[88px]";
  const matt = overlay?.logo_url && logoUrl === overlay.logo_url ? logoMatt(overlay.logo_url) : null;
  const antalIYrket = kommun && f.ng1 ? snapshotKommunBranschCount(kommun.code, f.ng1) : 0;
  // Registrets namn är en plural ("Ventilationsfirmor", "Elektriker") och går
  // att räkna med; yrkesnamnet ("Ventilation") gör det inte alltid.
  const flerOrd = (branschName ?? yrke)?.toLowerCase() ?? null;

  return (
    <div className="sg-wrap pb-16">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={faqJsonLd} />
      {/* Ort / Yrke / Namn — startsidan finns i märket. JSON-LD:n ovan har
          hela kedjan. */}
      <Breadcrumb items={breadcrumbItems.slice(1)} />

      {previewToken && <UtkastBanner />}

      {/* ========= HUVUD + KONTAKT =========
          Besökaren kom hit för att få tag på företaget. Numret står bredvid
          namnet, inte längre ner. */}
      <section
        id="kontakt"
        className={`border border-line bg-white ${profil ? "border-t-[6px] border-t-signal" : ""}`}
      >
        <div className="flex flex-col gap-6 p-5 sm:p-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="flex min-w-0 items-start gap-4 sm:gap-6">
            {logoUrl && (
              // Plain <img>, inte next/image: logotypen ligger i klustrets
              // storage, och en ny bucket-host ska inte kräva en ändring i
              // next.config.ts innan en logotyp kan visas.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`${name} logotyp`}
                width={matt?.bredd}
                height={matt?.hojd}
                // lazy som förut: utan det hissar React 19 in en preload-länk
                // i <head>, och huvudet ska vara oförändrat.
                loading="lazy"
                className={`${logoStorlek} shrink-0 border border-line-soft bg-white object-contain p-1.5`}
              />
            )}
            <div className="min-w-0 space-y-2">
              {profil ? (
                <p className="sg-label text-ad">Betald profil · uppgifter från företaget</p>
              ) : markning === "komplett" ? (
                <KomplettEtikett />
              ) : null}
              {(yrke || kommun) && (
                <p className="sg-label">
                  {yrke && yrkeHref ? (
                    <Link href={yrkeHref} className="underline-offset-4 hover:text-navy hover:underline">
                      {yrke}
                    </Link>
                  ) : (
                    yrke
                  )}
                  {yrke && kommun ? " · " : ""}
                  {kommun && (
                    <Link href={`/kommun/${kommun.slug}`} className="underline-offset-4 hover:text-navy hover:underline">
                      {kommun.name}
                    </Link>
                  )}
                </p>
              )}
              <h1 className="sg-display text-balance break-words text-[2.25rem] sm:text-[3rem]">
                {name}
              </h1>
              {undertitel && <p className="text-lg font-medium text-ink-2">{undertitel}</p>}
              {nyckeltal.length > 0 && (
                <p className="text-[15px] tabular-nums text-ink-2">{nyckeltal.join(" · ")}</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 lg:w-[20rem]">
            {visatTelefon ? (
              <RingKnapp telefon={visatTelefon} name={name} stor fylld className="flex w-full" />
            ) : (
              <p className="text-[15px] text-ink-2">Registret har inget telefonnummer till {name}.</p>
            )}
            {profil ? (
              <>
                {hemsida && (
                  <a href={hemsida} target="_blank" rel="nofollow noopener" className="sg-btn sg-btn-outline w-full">
                    Besök hemsida
                  </a>
                )}
                {epost && (
                  <a href={`mailto:${epost}`} className="sg-btn sg-btn-outline w-full">
                    Skicka e-post
                  </a>
                )}
              </>
            ) : (
              mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="nofollow noopener" className="sg-btn sg-btn-outline w-full">
                  Visa på karta
                </a>
              )
            )}
            {visatTelefon && (
              <p className="text-sm leading-snug text-ink-3">
                {egetNummer
                  ? "Numret är lämnat av företaget."
                  : `Numret kommer från registret (ca ${REGISTER_AR}) och kan vara inaktuellt.`}
              </p>
            )}
          </div>
        </div>
      </section>

      {visatTelefon && <MobilRingrad telefon={visatTelefon} namn={name} ankareId="kontakt" />}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {profil ? (
            <>
              {profil.infoHtml && (
                <section className="sg-panel p-5 sm:p-8">
                  <h2 className="sg-label">Om oss</h2>
                  <div
                    className="rd-rich-text mt-3 max-w-prose text-[16px] leading-relaxed text-ink-2"
                    dangerouslySetInnerHTML={{ __html: profil.infoHtml }}
                  />
                </section>
              )}
              {profil.tjanster.length > 0 && (
                <section className="sg-panel p-5 sm:p-8">
                  <h2 className="sg-label">Tjänster</h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {profil.tjanster.map((t) => (
                      <li key={t} className="sg-tag">
                        {t}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <section className="sg-panel p-5 sm:p-8">
              <h2 className="sg-label">Om företaget</h2>
              {sanitizedInfotext ? (
                <div
                  className="rd-rich-text mt-3 max-w-prose text-[16px] leading-relaxed text-ink-2"
                  dangerouslySetInnerHTML={{ __html: sanitizedInfotext }}
                />
              ) : (
                <p className="mt-3 max-w-prose text-[16px] leading-relaxed text-ink-2">{description}</p>
              )}
              {f.kontaktperson && (
                <p className="mt-4 text-[15px] text-ink-2">
                  Kontaktperson: <span className="font-semibold text-ink">{f.kontaktperson}</span>
                </p>
              )}
              {sokord.length > 0 && (
                <>
                  <h3 className="sg-label mt-6">Tjänster och sökord</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {sokord.map((s) => (
                      <li key={s}>
                        <Link
                          href={`/sok?q=${encodeURIComponent(s)}`}
                          className="sg-tag transition-colors hover:border-navy hover:text-navy"
                          title={`Sök ${s}`}
                        >
                          {s}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {/* ========= REGISTERFAKTA ========= */}
          <section className="sg-panel p-5 sm:p-8">
            <h2 className="sg-label">Uppgifter ur registret</h2>
            <dl className="mt-3 border-t border-line">
              <InfoRow
                label="Organisationsnummer"
                value={
                  orgnrInfo?.kind === "orgnr" ? (
                    <span className="tabular-nums">{orgnrInfo.value}</span>
                  ) : orgnrInfo?.kind === "hidden" ? (
                    <span className="text-ink-2">{orgnrInfo.value}</span>
                  ) : null
                }
              />
              <InfoRow label="Bolagsform" value={legalForm} />
              <InfoRow
                label="Bransch"
                value={
                  branschName ? (
                    <>
                      {branschName}
                      {f.ng1 ? <span className="tabular-nums text-ink-3"> · SNI {f.ng1}</span> : null}
                    </>
                  ) : null
                }
              />
              <InfoRow
                label="Anställda"
                value={size ? <span className="tabular-nums">{size.label}</span> : null}
              />
              <InfoRow
                label="Besöksadress"
                value={
                  f.gatuadress || f.postort ? (
                    <address className="not-italic">
                      {[f.gatuadress, [f.postnr, f.postort].filter(Boolean).join(" ")]
                        .filter(Boolean)
                        .join(", ")}
                    </address>
                  ) : null
                }
              />
              <InfoRow
                label="Kommun / län"
                value={
                  kommun ? (
                    <>
                      <Link href={`/kommun/${kommun.slug}`} className="sg-link">
                        {kommun.name}
                      </Link>
                      {lan ? ` · ${lan.name}s län` : ""}
                    </>
                  ) : null
                }
              />
              {!profil && webb && (
                <InfoRow
                  label="Hemsida"
                  value={
                    <a href={webb} target="_blank" rel="nofollow noopener" className="sg-link break-all">
                      {shortWebb(webb)}
                    </a>
                  }
                />
              )}
              {!profil && f.epostadress && (
                <InfoRow
                  label="E-post"
                  value={
                    <a href={`mailto:${f.epostadress}`} className="sg-link break-all">
                      {f.epostadress}
                    </a>
                  }
                />
              )}
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-ink-3">
              {personalOrgnr
                ? "Inget organisationsnummer visas — för en enskild firma är numret ett personnummer, och det hämtas aldrig ut ur databasen. "
                : ""}
              {PERSONUPPGIFT_FORKLARING} {REGISTER_FORKLARING}
            </p>
          </section>

          {/* ========= FAQ ========= */}
          <section className="sg-panel p-5 sm:p-8">
            <h2 className="sg-label">Frågor och svar om {name}</h2>
            <div className="mt-3 divide-y divide-line border-y border-line">
              {faqItems.map((it, i) => (
                <details key={i} className="group py-1" {...(i === 0 ? { open: true } : {})}>
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-[16px] font-bold text-ink">
                    {it.q}
                    <span
                      aria-hidden
                      className="shrink-0 text-xl font-bold leading-none text-navy transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-4 max-w-prose text-[15px] leading-relaxed text-ink-2">{it.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        {/* ========= HÖGER SPALT ========= */}
        <aside className="space-y-6" aria-label={profil ? "Kontakt och märkning" : "Ditt företag och fler i orten"}>
          {profil ? (
            <>
              <KontaktRuta profil={profil} omrade={omrade} />
              <OmMarkningen featured={markning === "betald"} />
            </>
          ) : (
            <>
              {/* Hantverkarens väg in: rätta registret eller köp en profil. */}
              <section className="sg-on-navy bg-navy p-6 text-white">
                <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-white">
                  Är det här ditt företag?
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--sg-on-navy-muted)]">
                  Lägg till logotyp, beskrivning, tjänster och rätt telefonnummer.
                </p>
                <Link href="/kontakt" className="sg-btn sg-btn-sok mt-5 w-full">
                  Uppdatera uppgifter
                </Link>
              </section>

              {kommun && related.length > 0 && (
                <section className="sg-panel p-5">
                  <h2 className="sg-label">
                    {flerOrd ? `Fler ${flerOrd} i ${kommun.name}` : `Fler hantverkare i ${kommun.name}`}
                  </h2>
                  <ul className="mt-2 divide-y divide-line-soft">
                    {related.map((rf) => (
                      <li key={rf.id}>
                        <Link
                          href={`/foretag/${foretagSlug(rf)}`}
                          className="flex min-h-12 items-center py-2 text-[15px] font-semibold text-ink underline-offset-4 hover:underline"
                        >
                          {overlayFor(rf, overlays)?.popularnamn?.trim() || displayName(rf)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={yrkeHref ?? `/kommun/${kommun.slug}`}
                    className="sg-link mt-3 inline-flex min-h-11 items-center text-[15px]"
                  >
                    {yrkeHref && flerOrd && antalIYrket > 0
                      ? `Alla ${antalIYrket.toLocaleString("sv-SE")} ${flerOrd}`
                      : `Alla hantverkare i ${kommun.name}`}
                  </Link>
                </section>
              )}
            </>
          )}
        </aside>
      </div>
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
    <div className="grid grid-cols-1 gap-0.5 border-b border-line py-3 text-[15px] sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-medium text-ink">
        {value ?? <span className="font-normal text-ink-3">Uppgift saknas</span>}
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
