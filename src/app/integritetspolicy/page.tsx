import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, buildBreadcrumb } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
import { REGISTER_AR } from "@/lib/dataprovenans";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";
const EMAIL = "kundservice@hantverkardelen.se";
const ORG_NUMBER = "556948-3141";
const UPPDATERAD = "1 november 2026";

export const metadata: Metadata = {
  title: "Integritetspolicy",
  description:
    "Hur Hantverkardelen behandlar personuppgifter: vilka uppgifter som visas, vilka som aldrig visas, varifrån de kommer och hur du får en uppgift borttagen.",
  alternates: { canonical: `${SITE_URL}/integritetspolicy` },
};

/**
 * Integritetspolicyn. Varje påstående här ska motsvara vad koden gör:
 *   - lib/personuppgifter.ts  — mobilnummer, privat e-post, kontaktperson och
 *                               personnamn för enskild firma visas inte
 *   - lib/kontaktsparr.ts     — spärren som tar bort en uppgift på begäran
 *   - lib/dataprovenans.ts    — registrets ålder
 *   - app/layout.tsx          — Vercel Analytics (cookiefri)
 *   - skiffer-crm, DE.82      — registret används för säljsamtal
 * Ändras koden ska texten ändras med den.
 */
export default function IntegritetspolicyPage() {
  const breadcrumbJsonLd = buildBreadcrumb([
    { name: "Hantverkardelen", url: SITE_URL },
    { name: "Integritetspolicy", url: `${SITE_URL}/integritetspolicy` },
  ]);

  return (
    <div className="sg-wrap pb-16">
      <JsonLd data={breadcrumbJsonLd} />
      <Breadcrumb items={[{ name: "Hantverkardelen", href: "/" }, { name: "Integritetspolicy" }]} />

      <article className="max-w-3xl space-y-8 text-[16px] leading-relaxed text-ink-2">
        <header className="space-y-3 border-b border-line pb-6">
          <h1 className="sg-display text-balance text-[2.125rem] sm:text-[2.75rem]">Integritetspolicy</h1>
          <p className="text-sm text-ink-3">Senast uppdaterad {UPPDATERAD}</p>
        </header>

        <Avsnitt rubrik="Vem som ansvarar">
          <p>
            Personuppgiftsansvarig för hantverkardelen.se är QS Group AB, organisationsnummer{" "}
            <span className="tabular-nums">{ORG_NUMBER}</span>. Frågor om personuppgifter skickar du till{" "}
            <a href={`mailto:${EMAIL}`} className="sg-link">
              {EMAIL}
            </a>{" "}
            eller via <Link href="/kontakt" className="sg-link">kontaktsidan</Link>.
          </p>
        </Avsnitt>

        <Avsnitt rubrik="Uppgifterna i katalogen">
          <p>
            Katalogen bygger på ett näringslivsregister som samlades in omkring 2008–{REGISTER_AR}. Det
            innehåller företagsnamn, adress, bransch, juridisk form och i många fall ett telefonnummer.
            Registret har inte uppdaterats sedan dess, så uppgifter kan vara inaktuella och företag kan ha
            upphört.
          </p>
          <p>
            De flesta uppgifterna gäller aktiebolag och andra juridiska personer och är inte personuppgifter.
            För en enskild firma är däremot firmans uppgifter också ägarens. Därför visar vi aldrig:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>telefonnummer ur registret — ett nummer visas bara när företaget självt har lämnat det</li>
            <li>personnummer — för en enskild firma visas inget organisationsnummer alls</li>
            <li>ägarens namn när firman saknar ett eget firmanamn — den visas som ”Enskild firma i” orten</li>
            <li>e-postadresser hos privata e-posttjänster, till exempel Hotmail, Gmail och Telia</li>
            <li>namngivna kontaktpersoner ur registret</li>
          </ul>
          <p>
            Undantaget är företag som själva har lämnat uppgifter för att synas här. Då visas det företaget
            lämnat.
          </p>
          <p>
            Vi behandlar katalogens uppgifter med stöd av intresseavvägning (artikel 6.1 f i
            dataskyddsförordningen): intresset av att privatpersoner och företag ska kunna hitta och kontakta
            lokala hantverksföretag. Uppgifterna finns kvar så länge katalogen visar företaget.
          </p>
        </Avsnitt>

        <Avsnitt rubrik="Säljkontakt per telefon">
          <p>
            QS Group AB använder registrets telefonnummer för att ringa företag och erbjuda annonsering i
            katalogen och i våra systerkataloger. Numren publiceras inte. Den lagliga grunden är berättigat
            intresse (artikel 6.1 f i dataskyddsförordningen): vårt intresse av att erbjuda företag en tjänst
            som rör deras verksamhet.
          </p>
          <p>
            Du har rätt att när som helst invända mot att bli kontaktad. Säg det i samtalet eller skriv till{" "}
            <a href={`mailto:${EMAIL}`} className="sg-link">
              {EMAIL}
            </a>
            , så spärrar vi numret. Spärren gäller också för säljsamtal och för våra systerkataloger.
          </p>
        </Avsnitt>

        <Avsnitt rubrik="Få en uppgift rättad eller borttagen">
          <p>
            Står ett nummer eller en annan uppgift om dig på ett företag den inte hör till, eller vill du inte
            att din firma visas? Kontakta oss så tar vi bort uppgiften. En borttagen uppgift spärras: den visas
            inte på sidan, i listorna, i sökningen eller i sidans strukturerade data, och den kommer inte tillbaka om
            registret läses in på nytt. Spärren gäller också våra systerkataloger.
          </p>
          <p>
            Du har rätt att få veta vilka uppgifter vi har om dig, att få fel rättade, att invända mot
            behandlingen och att få uppgifter raderade. Är du inte nöjd med hur vi hanterar en begäran kan du
            vända dig till Integritetsskyddsmyndigheten (IMY).
          </p>
        </Avsnitt>

        <Avsnitt rubrik="Företag som köper en profil">
          <p>
            Ett företag som köper en profil lämnar själv uppgifterna som visas: logotyp, beskrivning, tjänster,
            telefonnummer, e-post och kontaktperson. De behandlas för att fullgöra avtalet och visas så länge
            avtalet gäller.
          </p>
        </Avsnitt>

        <Avsnitt rubrik="Besöksstatistik">
          <p>
            Vi mäter hur sajten används, till exempel vilka sidor som besöks, med Vercel Web Analytics. Mätningen
            sätter inga kakor och sparar ingenting i din webbläsare. Besök räknas utan att du kan identifieras:
            ingen IP-adress sparas, och samma besökare känns inte igen från en dag till nästa. Uppgifterna
            används inte för annonsering.
          </p>
        </Avsnitt>

        <Avsnitt rubrik="När du kontaktar oss">
          <p>
            Skriver eller ringer du till oss sparar vi det du skickar så länge ärendet pågår och därefter så
            länge bokföringsregler eller ett kundförhållande kräver det.
          </p>
        </Avsnitt>
      </article>
    </div>
  );
}

function Avsnitt({ rubrik, children }: { rubrik: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">{rubrik}</h2>
      {children}
    </section>
  );
}
