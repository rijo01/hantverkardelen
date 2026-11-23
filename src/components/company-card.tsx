import Link from "next/link";
import { foretagSlug, type Foretag } from "@/lib/queries";
import { sidhuvudetsLogotyp, type OverlayProfilRow } from "@/lib/overlay-contract";
import { visatTelefon } from "@/lib/visat-telefon";
import { safeLogotypUrl } from "@/lib/sanitize-html";
import { REGISTER_AR } from "@/lib/dataprovenans";
import { yrkesnamn } from "@/lib/yrkesnamn";
import { yrkeFor } from "@/lib/kluster/klassning";
import { VISA_REGISTERTELEFON } from "@/lib/flaggor";
import { anstallda } from "@/lib/storleksklass";
import {
  displayName,
  normalizeWebb,
  shortWebb,
  profilMarkning,
  type ProfilMarkning,
} from "@/lib/foretag-format";

/**
 * Ett telefonnummer ur en publicerbar källa, med varifrån det kommer och när.
 * Förberett för det färska registret (läge b): ett nummer ur SCB eller annan
 * källa vi får publicera. Dagens data har inga sådana — registrets nummer
 * publiceras aldrig (DE.82).
 */
export type Kontaktvag = { telefon: string; kalla: string; datum?: string | null };

/**
 * En rad i en träfflista. EN komponent, tre lägen:
 *
 *   a) registerrad: namn, yrke, ort — och hemsidelänk när registret har en.
 *   b) med kontaktväg: dessutom Ring-knapp och källa/datum för numret.
 *      Avstängt bakom VISA_REGISTERTELEFON (lib/flaggor.ts) tills vidare.
 *   c) kund eller bekräftad profil (poang > 0 eller overlay): dessutom
 *      logotyp, tjänster och arbetsområde, och numret företaget lämnat.
 *
 * Annonser (aktivt overlay-köp, featured) märks "Annons" och får orange ram.
 * Namnet skrivs som registret skriver det; bara typografin är lättare.
 */
export function CompanyCard({
  foretag,
  branschName,
  kommunName,
  showOrt = true,
  /**
   * Den betalda profilen, när företaget har en. Skickas in av listsidan så att
   * raden slipper göra ett eget uppslag — listan har redan hela lagret i
   * minnet (se loadAktivaOverlays).
   */
  overlay = null,
  tjanster = [],
  arbetsomrade = [],
  kontaktvag = null,
}: {
  foretag: Foretag;
  /** Ignoreras — listorna är inte en topplista. Kvar för anroparnas skull. */
  rank?: number;
  branschName?: string | null;
  kommunName?: string | null;
  showOrt?: boolean;
  overlay?: OverlayProfilRow | null;
  /** Läge c: registrets sökord för kunden (listTjansterForKunder). Overlayns ord går före. */
  tjanster?: string[];
  /** Läge c: kommunerna företaget arbetar i (kontrakt 1.7, verksamhetsomrade). */
  arbetsomrade?: string[];
  /** Läge b: ett publicerbart nummer ur registret, med källa och datum. */
  kontaktvag?: Kontaktvag | null;
}) {
  const name = overlay?.popularnamn?.trim() || displayName(foretag);
  const markning = profilMarkning(foretag, overlay);
  const betald = markning === "betald";
  const kund = markning != null || overlay != null;
  // Kundens eget nummer (overlay eller poang) går före; annars läge b:s nummer.
  const kundensTelefon = visatTelefon(foretag.tel, overlay);
  // Läge b är avstängt bakom flaggan tills SCB:s villkor är lästa (lib/flaggor.ts).
  const registernummer = VISA_REGISTERTELEFON ? kontaktvag : null;
  const telefon = kundensTelefon ?? registernummer?.telefon ?? null;
  const nummerKalla = kundensTelefon
    ? "Lämnat av företaget"
    : registernummer
      ? [`Källa: ${registernummer.kalla}`, registernummer.datum].filter(Boolean).join(", ")
      : null;
  const size = anstallda(foretag.storleksklass);
  const logo = kund ? (sidhuvudetsLogotyp(overlay, safeLogotypUrl(foretag.logotyp))?.url ?? null) : null;
  const href = `/foretag/${foretagSlug(foretag)}`;
  const yrke = yrkeFor(foretag) ?? branschName ?? (foretag.ng1 ? yrkesnamn(foretag.ng1) : null);
  const ort = showOrt ? kommunName || ortnamn(foretag.postort) : null;
  const fakta = [yrke, ort, size?.label].filter(Boolean);
  const beskrivning = betald ? forstaRaden(overlay?.info_html) : null;
  const tjanstLista = kund ? (overlay?.keywords?.length ? overlay.keywords : tjanster).slice(0, 6) : [];
  const hemsida = normalizeWebb(overlay?.hemsida ?? foretag.webb);
  // Betald länk: sponsored. Registrets gamla adress: nofollow.
  const hemsidaRel = kund ? "sponsored noopener" : "nofollow noopener";

  return (
    <article
      className={
        betald
          ? "border-2 border-signal bg-white px-[15px] py-[15px] sm:px-[19px]"
          : "sg-panel px-4 py-4 sm:px-5"
      }
    >
      <div className="flex items-start gap-4">
        {logo && (
          /* Plain <img>: logotyperna ligger i klustrets storage, och en ny
             bucket-host ska inte kräva en ändring i next.config.ts. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logo}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-14 shrink-0 border border-line-soft bg-white object-contain p-1 sm:size-16"
          />
        )}
        <div className="min-w-0 flex-1">
          {markning && <AnnonsEtikett />}
          <h3 className="min-w-0 text-[17px] font-semibold leading-snug text-ink">
            <Link href={href} className="underline-offset-4 hover:underline">
              {name}
            </Link>
          </h3>
          {fakta.length > 0 && (
            <p className="mt-0.5 text-[15px] leading-snug text-ink-2">{fakta.join(" · ")}</p>
          )}
          {beskrivning && (
            <p className="mt-1 line-clamp-1 text-[15px] text-ink-2">{beskrivning}</p>
          )}
          {tjanstLista.length > 0 && (
            <p className="mt-1.5 line-clamp-2 text-[14px] leading-snug text-ink-2">
              <span className="font-semibold text-ink">Tjänster:</span> {tjanstLista.join(", ")}
            </p>
          )}
          {kund && arbetsomrade.length > 0 && (
            <p className="mt-1 line-clamp-1 text-[14px] leading-snug text-ink-2">
              <span className="font-semibold text-ink">Arbetsområde:</span> {arbetsomrade.join(", ")}
            </p>
          )}
          {hemsida && (
            <p className="mt-1.5 text-[14px]">
              <a href={hemsida} target="_blank" rel={hemsidaRel} className="sg-link break-all">
                {shortWebb(hemsida)}
              </a>
            </p>
          )}
          {telefon && (
            <RingKnapp
              telefon={telefon}
              name={name}
              fylld={betald}
              className="mt-3 flex w-full sm:hidden"
            />
          )}
          {nummerKalla && <p className="mt-1 text-[13px] text-ink-3 sm:hidden">{nummerKalla}</p>}
        </div>
        {telefon && (
          <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
            <RingKnapp telefon={telefon} name={name} fylld={betald} />
            {nummerKalla && <p className="text-[13px] text-ink-3">{nummerKalla}</p>}
          </div>
        )}
        {/* Plats för "Begär offert" när offertflödet finns — bredvid numret,
            aldrig i stället för det. */}
      </div>
    </article>
  );
}

/** Etiketten för profilMarkning(): båda lägena är betalda placeringar och märks "Annons". */
export function ProfilEtikett({ markning }: { markning: ProfilMarkning }) {
  return markning ? <AnnonsEtikett /> : null;
}

/** Betald placering. Texten säger vad det är, inte bara att det syns. */
export function AnnonsEtikett() {
  return (
    <p
      className="mb-1 inline-block border border-ad px-1.5 py-px text-[12px] font-bold uppercase tracking-[0.06em] text-ad"
      title="Företaget betalar för att synas före andra. Placeringen säger inget om kvaliteten."
    >
      Annons
    </p>
  );
}

/** Registrets poang — en betald placering som styr sorteringen, alltså en annons. */
export function KomplettEtikett() {
  return <AnnonsEtikett />;
}

/**
 * Ringknappen — samma i alla listor och på företagssidan. Kantad navy som
 * standard, fylld navy för betalda rader och företagssidans huvud. Numret
 * står alltid i klartext. Det är alltid lämnat av företaget självt, så
 * ingen åldersmärkning behövs.
 */
export function RingKnapp({
  telefon,
  name,
  className = "",
  stor = false,
  fylld = false,
}: {
  telefon: string;
  name: string;
  className?: string;
  stor?: boolean;
  fylld?: boolean;
}) {
  return (
    <a
      href={`tel:${telefon.replace(/[^\d+]/g, "")}`}
      aria-label={`Ring ${name}, ${telefon}`}
      className={`sg-btn whitespace-nowrap tabular-nums ${fylld ? "sg-btn-navy" : "sg-btn-outline"} ${
        stor ? "min-h-[3.25rem] px-5 text-[17px]" : "text-[15px]"
      } ${className || "inline-flex"}`}
    >
      Ring
      <span className={fylld ? "font-semibold" : "font-semibold text-ink-2"}>{telefon}</span>
    </a>
  );
}

/**
 * Listan. Raderna är fristående vita ytor; under dem står hur listan är
 * sorterad och varifrån numren kommer.
 */
export function CompanyCardList({
  children,
}: {
  children: React.ReactNode;
  /** Kvar för anroparnas skull; alla betalda placeringar heter nu "Annons". */
  komplettaFinns?: boolean;
}) {
  return (
    <div>
      <ol className="space-y-2">{children}</ol>
      <p className="mt-4 text-sm leading-relaxed text-ink-3">
        Sorterat: annonser först, därefter efter antal arbetsställen. Antal anställda är registrets storleksklass från ca {REGISTER_AR}.
        Telefonnummer visas när företaget självt har lämnat dem. Hemsidor ur registret kan vara
        inaktuella.
      </p>
    </div>
  );
}

/** "KUNGÄLV" → "Kungälv". Registrets postorter står ofta i versaler. */
function ortnamn(postort: string | null): string | null {
  const s = postort?.trim();
  if (!s) return null;
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, f: string, c: string) => f + c.toUpperCase());
}

/** Kundens infotext som en rad ren text — taggarna bort, entiteterna tolkade. */
function forstaRaden(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}
