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
    <div className="space-y-12 pb-8">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={organizationJsonLd} />
      <Breadcrumb items={breadcrumbItems} />

      <header className="max-w-3xl space-y-3">
        <h1 className="rd-serif text-balance text-[2.5rem] text-[var(--text-strong)] sm:text-[3.5rem]">
          Kontakta oss
        </h1>
        <p className="text-lg leading-relaxed text-[var(--text-muted)]">
          Fel nummer eller adress till ett företag? Vill du synas med logotyp,
          beskrivning och tjänster? Eller har du en fråga om katalogen? Hör av dig.
        </p>
      </header>

      <section aria-labelledby="na-oss" className="space-y-4">
        <h2 id="na-oss" className="rd-serif text-3xl text-[var(--text-strong)] sm:text-4xl">
          Så når du oss
        </h2>
        <dl className="grid gap-6 border-t border-[var(--rule)] pt-5 sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
              <Phone className="size-4 text-[var(--brand)]" aria-hidden />
              Telefon
            </dt>
            <dd className="mt-1">
              <a
                href={`tel:${PHONE_TEL}`}
                className="inline-flex min-h-11 items-center text-lg font-semibold tabular-nums text-[var(--brand-ink)] underline-offset-4 hover:underline"
              >
                {PHONE_DISPLAY}
              </a>
              <p className="text-sm text-[var(--text-muted)]">Vardagar 09–17</p>
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
              <Mail className="size-4 text-[var(--brand)]" aria-hidden />
              E-post
            </dt>
            <dd className="mt-1">
              <a
                href={`mailto:${EMAIL}`}
                className="inline-flex min-h-11 items-center break-all text-lg font-semibold text-[var(--brand-ink)] underline-offset-4 hover:underline"
              >
                {EMAIL}
              </a>
              <p className="text-sm text-[var(--text-muted)]">Svar inom 1–2 arbetsdagar</p>
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
              <MapPin className="size-4 text-[var(--brand)]" aria-hidden />
              Postadress
            </dt>
            <dd className="mt-1">
              <address className="not-italic text-[15px] leading-relaxed text-[var(--text-body)]">
                {ADDRESS_LINES.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl bg-[var(--surface-soft)] p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[var(--text-strong)]">
          Hantverkardelen drivs av QS Group AB
        </h2>
        <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
          Organisationsnummer <span className="tabular-nums text-[var(--text-strong)]">{ORG_NUMBER}</span>.
          Vi tar emot post digitalt via Kivra — använd adressen ovan vid fysisk post.
        </p>
      </section>
    </div>
  );
}
