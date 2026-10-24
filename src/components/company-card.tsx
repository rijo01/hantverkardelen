import Link from "next/link";
import { foretagSlug, type Foretag } from "@/lib/queries";
import { sidhuvudetsLogotyp, type OverlayProfilRow } from "@/lib/overlay-contract";
import { visatTelefon } from "@/lib/visat-telefon";
import { safeLogotypUrl } from "@/lib/sanitize-html";
import { KONTAKT_NOTIS, REGISTER_AR } from "@/lib/dataprovenans";
import { yrkesnamn } from "@/lib/yrkesnamn";
import {
  displayName,
  employerSize,
  profilMarkning,
  type ProfilMarkning,
} from "@/lib/foretag-format";

/**
 * En rad i en träfflista.
 *
 * Besökaren skannar efter tre saker: vem, var och vilket nummer. Raden visar
 * exakt dem. Namnet är radens starkaste element och den enda länken till
 * profilen; numret står i klartext i Ring-knappen så att man kan se
 * riktnumret innan man ringer ett nummer ur ett register från 2011.
 *
 * Logotypen visas när företaget har en — den köpta före registrets, samma
 * regel som profilsidans huvud (kontraktets sidhuvudetsLogotyp()). Saknas den
 * visas ingenting: ingen monogram-avatar, ingen platshållare.
 *
 * Tre lägen, och bara profilMarkning() avgör vilket:
 *   "betald"   — aktivt overlay-köp: 2px orange ram, "Utvald · annons",
 *                kundens egen beskrivning på en rad och navy Ring-knapp.
 *   "komplett" — registrets gamla poang: neutral etikett, ingen ram.
 *   null       — registerraden som den är.
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
}: {
  foretag: Foretag;
  /** Ignoreras — listorna är inte en topplista. Kvar för anroparnas skull. */
  rank?: number;
  branschName?: string | null;
  kommunName?: string | null;
  showOrt?: boolean;
  overlay?: OverlayProfilRow | null;
}) {
  const name = overlay?.popularnamn?.trim() || displayName(foretag);
  // Samma regel som profilsidan: kundens köpta nummer ersätter registrets.
  const telefon = visatTelefon(foretag.tel, overlay);
  const size = employerSize(foretag.aeant);
  const markning = profilMarkning(foretag, overlay);
  const betald = markning === "betald";
  const logo = sidhuvudetsLogotyp(overlay, safeLogotypUrl(foretag.logotyp))?.url ?? null;
  const href = `/foretag/${foretagSlug(foretag)}`;
  const yrke = branschName ?? (foretag.ng1 ? yrkesnamn(foretag.ng1) : null);
  const ort = showOrt ? kommunName || ortnamn(foretag.postort) : null;
  const fakta = [yrke, ort, size?.label].filter(Boolean);
  const beskrivning = betald ? forstaRaden(overlay?.info_html) : null;

  return (
    <article
      className={
        betald
          ? "border-2 border-signal bg-white px-[15px] py-[15px] sm:px-[19px]"
          : "sg-panel px-4 py-4 sm:px-5"
      }
    >
      <div className="flex items-start gap-4 sm:items-center">
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
          {betald && <AnnonsEtikett />}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Link
              href={href}
              className="text-[19px] font-bold leading-snug tracking-[-0.01em] text-ink underline-offset-4 hover:underline"
            >
              {name}
            </Link>
            {markning === "komplett" && <KomplettEtikett />}
          </div>
          {fakta.length > 0 && (
            <p className="mt-0.5 text-[15px] leading-snug text-ink-2">{fakta.join(" · ")}</p>
          )}
          {beskrivning && (
            <p className="mt-1 line-clamp-1 text-[15px] text-ink-2">{beskrivning}</p>
          )}
          {telefon && (
            <RingKnapp
              telefon={telefon}
              name={name}
              fylld={betald}
              className="mt-3 flex w-full sm:hidden"
            />
          )}
        </div>
        {telefon && (
          <RingKnapp
            telefon={telefon}
            name={name}
            fylld={betald}
            className="hidden shrink-0 sm:inline-flex"
          />
        )}
        {/* Plats för "Begär offert" när offertflödet finns — bredvid numret,
            aldrig i stället för det. */}
      </div>
    </article>
  );
}

/** Etiketten för profilMarkning(): annons för köp, neutral för registrets poang. */
export function ProfilEtikett({ markning }: { markning: ProfilMarkning }) {
  if (markning === "betald") return <AnnonsEtikett />;
  if (markning === "komplett") return <KomplettEtikett />;
  return null;
}

/** Betald placering. Texten säger vad det är, inte bara att det syns. */
export function AnnonsEtikett() {
  return (
    <p
      className="mb-0.5 text-[12px] font-bold uppercase tracking-[0.06em] text-ad"
      title="Företaget betalar för att synas först. Placeringen säger inget om kvaliteten."
    >
      Utvald · annons
    </p>
  );
}

/** Registrets gamla poang. Neutral — det är inte en annons och inget betyg. */
export function KomplettEtikett() {
  return (
    <span
      className="inline-flex items-center border border-line px-1.5 py-0.5 text-xs font-semibold text-ink-2"
      title="Företagets registeruppgifter är kompletta. Inte en annons."
    >
      Komplett profil
    </span>
  );
}

/**
 * Ringknappen — samma i alla listor och på företagssidan. Kantad navy som
 * standard, fylld navy för betalda rader och företagssidans huvud. Numret
 * står alltid i klartext; märkningen om registrets ålder ligger i
 * aria-label och title.
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
      aria-label={`Ring ${name}, ${telefon}. ${KONTAKT_NOTIS}.`}
      title={KONTAKT_NOTIS}
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
  komplettaFinns = false,
}: {
  children: React.ReactNode;
  /** Finns rader med registrets poang ("Komplett profil")? Då nämns de i sorteringen. */
  komplettaFinns?: boolean;
}) {
  return (
    <div>
      <ol className="space-y-2">{children}</ol>
      <p className="mt-4 text-sm leading-relaxed text-ink-3">
        Sorterat: annonser först,{" "}
        {komplettaFinns ? "därefter företag med komplett profil och sedan" : "därefter"} efter
        antal anställda. Telefonnummer från registret (ca {REGISTER_AR}) kan vara inaktuella.
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
