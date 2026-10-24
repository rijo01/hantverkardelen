import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { SiteNav, MobileBottomNav } from "@/components/site-nav";
import { Ordmarke } from "@/components/ordmarke";
import {
  PERSONUPPGIFT_FORKLARING,
  REGISTER_AR,
  REGISTER_FORKLARING,
} from "@/lib/dataprovenans";
import { GoogleAnalytics } from "@next/third-parties/google";
import { GA_ID } from "@/lib/site";

// Archivo är en variabel font: en fil täcker 400–800, i stället för fem.
const archivo = Archivo({
  variable: "--font-archivo",
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
    <html lang="sv" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-page text-ink-2">
        <SiteNav />
        <main className="w-full flex-1">{children}</main>
        <footer className="sg-on-navy bg-navy pb-24 text-[var(--sg-on-navy-muted)] md:pb-0">
          <div className="sg-wrap grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1.4fr]">
            <div className="space-y-4">
              <Ordmarke />
              <p className="max-w-sm text-[15px] leading-relaxed">
                Data från offentliga register. Är det här ditt företag?{" "}
                <a href="/kontakt" className="font-semibold text-white underline underline-offset-4">
                  Uppdatera dina uppgifter
                </a>
              </p>
            </div>
            <div>
              <p className="sg-label text-white">Hitta hantverkare</p>
              <ul className="mt-3 text-[15px]">
                {[
                  ["/", "Startsidan"],
                  ["/kommuner", "Alla 290 kommuner"],
                  ["/branscher", "Alla yrken"],
                  ["/sok", "Sök"],
                  ["/kontakt", "För hantverkare"],
                ].map(([href, text]) => (
                  <li key={href}>
                    <a
                      href={href}
                      className="inline-flex min-h-9 items-center underline-offset-4 hover:text-white hover:underline"
                    >
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3 text-sm leading-relaxed">
              <p className="sg-label text-white">Integritet</p>
              <p>{PERSONUPPGIFT_FORKLARING}</p>
              <p>{REGISTER_FORKLARING}</p>
              <p>
                Vill du få en uppgift rättad eller borttagen?{" "}
                <a href="/kontakt" className="text-white underline underline-offset-4">
                  Kontakta oss
                </a>
                .
              </p>
            </div>
          </div>
          <div className="border-t border-white/15">
            <p className="sg-wrap py-5 text-sm">
              © {new Date().getFullYear()} Hantverkardelen · Data från
              offentligt näringslivsregister, ca {REGISTER_AR}
            </p>
          </div>
        </footer>
        <MobileBottomNav />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <GoogleAnalytics gaId={GA_ID} />
      </body>
    </html>
  );
}
