import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { JsonLd, buildBreadcrumb } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";

const PHONE_DISPLAY = "031-266455";
const PHONE_TEL = "+4631266455";
const EMAIL = "kundservice@hantverkardelen.se";
const ORG_NUMBER = "556948-3141";
const ADDRESS_LINES = [
  "c/o QS Group AB",
  `Kivra: ${ORG_NUMBER}`,
  "106 31 Stockholm",
];

export const metadata: Metadata = {
  title: "Kontakta oss – Hantverkardelen",
  description: `Kontakta Hantverkardelen. Kundservice: ${PHONE_DISPLAY}, e-post ${EMAIL}. Postadress c/o QS Group AB, Kivra: ${ORG_NUMBER}, 106 31 Stockholm.`,
  alternates: { canonical: `${SITE_URL}/kontakt` },
};

export default function KontaktPage() {
  const breadcrumbItems = [
    { name: "Hantverkardelen", href: "/" },
    { name: "Kontakt" },
  ];
  const breadcrumbJsonLd = buildBreadcrumb([
    { name: "Hantverkardelen", url: SITE_URL },
    { name: "Kontakt", url: `${SITE_URL}/kontakt` },
  ]);

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Hantverkardelen",
    url: SITE_URL,
    email: EMAIL,
    telephone: PHONE_TEL,
    identifier: ORG_NUMBER,
    vatID: ORG_NUMBER,
    address: {
      "@type": "PostalAddress",
      streetAddress: "c/o QS Group AB, Kivra: 556948-3141",
      postalCode: "106 31",
      addressLocality: "Stockholm",
      addressCountry: "SE",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: PHONE_TEL,
        email: EMAIL,
        areaServed: "SE",
        availableLanguage: ["Swedish", "sv"],
      },
    ],
  };

  return (
    <div className="space-y-10">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={organizationJsonLd} />
      <Breadcrumb items={breadcrumbItems} />

      {/* ======= HERO ======= */}
      <header className="rd-fade-up relative overflow-hidden rounded-3xl border border-[var(--rule)] bg-white rd-shadow-md">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(10,77,140,0.10), transparent 65%),"
              + "linear-gradient(180deg, #F4F6F8 0%, #ffffff 70%)",
          }}
        />
        <div className="relative space-y-4 p-6 sm:p-9">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--brand)]">
            <Mail aria-hidden className="size-3.5" />
            Kundservice
          </div>
          <h1 className="text-balance text-3xl font-semibold leading-[1.05] tracking-tight text-[var(--text-strong)] sm:text-[2.75rem]">
            Kontakta{" "}
            <span className="rd-display rd-text-brand text-[1.15em]">oss</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
            Har du frågor om Hantverkardelen, dina företagsuppgifter eller hur
            vår katalog fungerar? Vår kundservice hjälper dig gärna —
            kontakta oss på telefon, e-post eller via post.
          </p>
        </div>
      </header>

      {/* ======= KONTAKTKORT ======= */}
      <section className="space-y-5">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--brand)]">
            Direktkontakt
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">
            Så når du oss
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Telefon */}
          <li>
            <a
              href={`tel:${PHONE_TEL}`}
              className="rd-card rd-card-hover group relative flex h-full flex-col gap-3 overflow-hidden p-5"
              aria-label={`Ring kundservice på ${PHONE_DISPLAY}`}
            >
              <span
                aria-hidden
                className="inline-flex size-9 items-center justify-center rounded-xl bg-[var(--tint-2)] text-[var(--brand)]"
              >
                <Phone className="size-4" strokeWidth={2.2} />
              </span>
              <div className="space-y-1">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Telefon
                </p>
                <p className="text-lg font-semibold tracking-tight text-[var(--text-strong)] group-hover:text-[var(--brand-ink)]">
                  {PHONE_DISPLAY}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Vardagar 09–17
                </p>
              </div>
            </a>
          </li>

          {/* E-post */}
          <li>
            <a
              href={`mailto:${EMAIL}`}
              className="rd-card rd-card-hover group relative flex h-full flex-col gap-3 overflow-hidden p-5"
              aria-label={`Skicka e-post till ${EMAIL}`}
            >
              <span
                aria-hidden
                className="inline-flex size-9 items-center justify-center rounded-xl bg-[var(--tint-2)] text-[var(--brand)]"
              >
                <Mail className="size-4" strokeWidth={2.2} />
              </span>
              <div className="space-y-1">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  E-post
                </p>
                <p className="break-all text-lg font-semibold tracking-tight text-[var(--text-strong)] group-hover:text-[var(--brand-ink)]">
                  {EMAIL}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Svar inom 1–2 arbetsdagar
                </p>
              </div>
            </a>
          </li>

          {/* Postadress */}
          <li>
            <div className="rd-card relative flex h-full flex-col gap-3 overflow-hidden p-5">
              <span
                aria-hidden
                className="inline-flex size-9 items-center justify-center rounded-xl bg-[var(--tint-3)] text-[var(--accent-cta-ink)]"
              >
                <MapPin className="size-4" strokeWidth={2.2} />
              </span>
              <div className="space-y-1">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Postadress
                </p>
                <address className="not-italic text-[15px] font-medium leading-snug text-[var(--text-strong)]">
                  {ADDRESS_LINES.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
            </div>
          </li>
        </ul>
      </section>

      {/* ======= ORGANISATIONSINFO ======= */}
      <section className="rd-fade-up grid grid-cols-1 gap-5 rounded-3xl border border-[var(--accent-cta)]/25 bg-[var(--surface-warm)] p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--accent-cta-ink)]">
            Organisationsuppgifter
          </p>
          <h3 className="text-lg font-semibold text-[var(--text-strong)] sm:text-xl">
            Hantverkardelen drivs av QS Group AB
          </h3>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-body)]">
            Organisationsnummer{" "}
            <span className="font-mono tabular-nums text-[var(--text-strong)]">
              {ORG_NUMBER}
            </span>
            . Vi tar emot post digitalt via Kivra — använd adressen ovan vid
            fysisk post.
          </p>
        </div>
        <a
          href={`mailto:${EMAIL}`}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full rd-brand-gradient rd-cta-shadow px-5 text-sm font-semibold text-white transition hover:brightness-105 active:scale-[0.99]"
        >
          Mejla kundservice
          <Mail aria-hidden className="size-4" />
        </a>
      </section>
    </div>
  );
}
