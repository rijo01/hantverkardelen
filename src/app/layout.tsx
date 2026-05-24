import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Hammer } from "lucide-react";
import "./globals.css";
import { SiteNav, MobileBottomNav } from "@/components/site-nav";

function LogoMark() {
  return (
    <span
      aria-hidden
      className="relative inline-flex size-7 items-center justify-center rounded-lg bg-[var(--brand)] text-white shadow-[0_2px_6px_-2px_rgba(10,77,140,0.5)]"
    >
      <Hammer className="size-4" strokeWidth={2.2} />
    </span>
  );
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Hantverkardelen – Hitta rätt hantverkare i hela Sverige",
    template: "%s | Hantverkardelen",
  },
  description:
    "Sveriges katalog för hem & hantverk. Hitta elektriker, VVS, målare, snickare, byggföretag, takläggare, golvläggare och städ i alla 290 kommuner.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    siteName: "Hantverkardelen",
    locale: "sv_SE",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Hantverkardelen",
    url: SITE_URL,
    description:
      "Sveriges katalog för hem & hantverk — bygg, el, VVS, måleri, tak, snickeri, golv och städ i alla 290 kommuner.",
  };

  return (
    <html
      lang="sv"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-[var(--text-body)]">
        <SiteNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 md:pb-12">
          {children}
        </main>
        <footer className="border-t border-[var(--rule)] bg-[var(--surface-soft)]">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[2fr_1fr_1fr] sm:gap-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <LogoMark />
                <span className="text-sm font-semibold text-[var(--text-strong)]">
                  Hantverkardelen<span className="text-[var(--accent-cta)]">.se</span>
                </span>
              </div>
              <p className="max-w-sm text-sm text-[var(--text-muted)]">
                Sveriges katalog för hem & hantverk. Aggregerad data från
                offentliga register, person- och organisationsnummer maskas av
                integritetsskäl.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
                Utforska
              </p>
              <ul className="space-y-1.5 text-sm">
                <li>
                  <a
                    href="/"
                    className="text-[var(--text-body)] hover:text-[var(--brand-ink)]"
                  >
                    Startsidan
                  </a>
                </li>
                <li>
                  <a
                    href="/kommuner"
                    className="text-[var(--text-body)] hover:text-[var(--brand-ink)]"
                  >
                    Alla 290 kommuner
                  </a>
                </li>
                <li>
                  <a
                    href="/branscher"
                    className="text-[var(--text-body)] hover:text-[var(--brand-ink)]"
                  >
                    Hantverkskategorier
                  </a>
                </li>
                <li>
                  <a
                    href="/sok"
                    className="text-[var(--text-body)] hover:text-[var(--brand-ink)]"
                  >
                    Fritextsök
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
                Integritet
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Person- och organisationsnummer visas alltid maskat. Vi följer
                GDPR och visar endast publika företagsuppgifter.
              </p>
            </div>
          </div>
          <div className="border-t border-[var(--rule)]">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-[var(--text-dim)] sm:flex-row sm:items-center sm:justify-between">
              <span>
                © {new Date().getFullYear()} Hantverkardelen · Data från
                offentliga register
              </span>
              <span className="text-[var(--text-faint)]">
                Byggt i Sverige
              </span>
            </div>
          </div>
        </footer>
        <MobileBottomNav />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </body>
    </html>
  );
}
