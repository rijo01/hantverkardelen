import type { Metadata } from "next";
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
    <div className="sg-wrap space-y-8 pb-16">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={organizationJsonLd} />
      <div>
        <Breadcrumb items={breadcrumbItems} />
        <header className="max-w-3xl space-y-3 border-b border-line pb-6">
          <h1 className="sg-display text-balance text-[2.125rem] sm:text-[2.75rem]">
            Kontakta oss
          </h1>
          <p className="text-[17px] leading-relaxed text-ink-2">
            Fel nummer eller adress till ett företag? Vill du synas med logotyp,
            beskrivning och tjänster? Eller har du en fråga om katalogen? Hör av dig.
          </p>
        </header>
      </div>

      <section aria-labelledby="na-oss" className="space-y-3">
        <h2 id="na-oss" className="sg-label">
          Så når du oss
        </h2>
        <dl className="grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-3">
          <div className="bg-white p-5 sm:p-6">
            <dt className="sg-label">Telefon</dt>
            <dd className="mt-2">
              <a href={`tel:${PHONE_TEL}`} className="sg-btn sg-btn-navy text-[17px] tabular-nums">
                Ring {PHONE_DISPLAY}
              </a>
              <p className="mt-2 text-sm text-ink-3">Vardagar 09–17</p>
            </dd>
          </div>
          <div className="bg-white p-5 sm:p-6">
            <dt className="sg-label">E-post</dt>
            <dd className="mt-2">
              <a
                href={`mailto:${EMAIL}`}
                className="inline-flex min-h-11 items-center break-all text-[18px] font-bold text-navy underline underline-offset-4 decoration-line hover:decoration-navy"
              >
                {EMAIL}
              </a>
              <p className="text-sm text-ink-3">Svar inom 1–2 arbetsdagar</p>
            </dd>
          </div>
          <div className="bg-white p-5 sm:p-6">
            <dt className="sg-label">Postadress</dt>
            <dd className="mt-2">
              <address className="not-italic text-[16px] leading-relaxed text-ink">
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

      <section className="sg-panel p-5 sm:p-6">
        <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-ink">
          Hantverkardelen drivs av QS Group AB
        </h2>
        <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-ink-2">
          Organisationsnummer <span className="tabular-nums text-ink">{ORG_NUMBER}</span>.
          Vi tar emot post digitalt via Kivra — använd adressen ovan vid fysisk post.
        </p>
      </section>
    </div>
  );
}
