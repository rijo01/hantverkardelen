import Link from "next/link";
import { Phone } from "lucide-react";
import { foretagSlug, type Foretag } from "@/lib/queries";
import type { OverlayProfilRow } from "@/lib/overlay-contract";
import { visatTelefon } from "@/lib/visat-telefon";
import { KONTAKT_NOTIS, REGISTER_AR } from "@/lib/dataprovenans";
import {
  displayName,
  employerSize,
  legalFormFor,
  profilMarkning,
  type ProfilMarkning,
} from "@/lib/foretag-format";

/**
 * En rad i en träfflista.
 *
 * Besökaren skannar efter tre saker: vem, var och vilket nummer. Raden visar
 * exakt dem. Namnet är radens starkaste element och den enda länken till
 * profilen; numret står i klartext (även på mobil) så att man kan se
 * riktnumret innan man ringer ett nummer ur ett register från 2011.
 *
 * Ingen platshållaravatar: en bokstav på en gradient säger ingenting och tog
 * 70px av varje rad. Logotyp visas bara när kunden själv lämnat en.
 *
 * "Utvald · annons" visas bara för ett aktuellt overlay-köp (featured).
 * Registrets gamla poang får den neutrala "Komplett profil". Se profilMarkning().
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
  const legalForm = legalFormFor(foretag);
  const markning = profilMarkning(foretag, overlay);
  const href = `/foretag/${foretagSlug(foretag)}`;
  const adress = [foretag.gatuadress, foretag.postort].filter(Boolean).join(", ");
  const plats = showOrt ? adress || kommunName || null : null;
  const sokord = (overlay?.keywords ?? [])
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 4);

  const fakta = [branschName, plats, size?.label, legalForm].filter(Boolean);

  return (
    <article
      className={`rd-list-row px-4 py-3.5 sm:px-5 ${markning === "betald" ? "rd-list-row-featured" : ""}`}
    >
      <div className="flex items-start gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {overlay?.logo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={overlay.logo_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="mt-0.5 size-10 shrink-0 rounded-md border border-[var(--rule)] bg-white object-contain p-0.5"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={href}
                className="text-[15px] font-semibold leading-snug text-[var(--text-strong)] underline-offset-4 hover:text-[var(--brand-ink)] hover:underline sm:text-base"
              >
                {name}
              </Link>
              <ProfilEtikett markning={markning} />
            </div>
            {fakta.length > 0 && (
              <p className="mt-0.5 text-sm leading-snug text-[var(--text-muted)]">
                {fakta.join(" · ")}
              </p>
            )}
            {sokord.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Företagets tjänster">
                {sokord.map((s) => (
                  <li
                    key={s}
                    className="rounded-sm bg-white px-1.5 py-0.5 text-xs text-[var(--brand-ink)] ring-1 ring-[var(--rule)]"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
            {telefon && (
              <RingKnapp
                telefon={telefon}
                name={name}
                className="mt-2 inline-flex sm:hidden"
              />
            )}
          </div>
        </div>

        {telefon && (
          <RingKnapp telefon={telefon} name={name} className="hidden sm:inline-flex" />
        )}
        {/* Plats för "Begär offert" när offertflödet finns — bredvid numret,
            aldrig i stället för det. */}
      </div>
    </article>
  );
}

/** Etiketten för profilMarkning(): annons för köp, neutral för registrets poang. */
export function ProfilEtikett({ markning }: { markning: ProfilMarkning }) {
  if (markning === "betald") return <UtvaldMarke />;
  if (markning === "komplett") {
    return (
      <span
        className="inline-flex items-center rounded-sm bg-[var(--surface-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-muted)] ring-1 ring-[var(--rule)]"
        title="Företagets registeruppgifter är kompletta. Inte en annons."
      >
        Komplett profil
      </span>
    );
  }
  return null;
}

/** Märket för betald placering. Texten säger vad det är, inte bara att det syns. */
export function UtvaldMarke() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm bg-[var(--tint-3)] px-1.5 py-0.5 text-xs font-semibold text-[var(--accent-cta-ink)]"
      title="Företaget betalar för att synas först. Placeringen säger inget om kvaliteten."
    >
      Utvald
      <span className="font-normal">· annons</span>
    </span>
  );
}

/**
 * Ringknappen — samma utseende i alla listor och på företagssidan.
 * Blå kontur: orange är reserverat för sökningen. Numret står alltid i
 * klartext; märkningen om registrets ålder ligger i aria-label och title.
 */
export function RingKnapp({
  telefon,
  name,
  className = "",
  stor = false,
}: {
  telefon: string;
  name: string;
  className?: string;
  stor?: boolean;
}) {
  return (
    <a
      href={`tel:${telefon.replace(/[^\d+]/g, "")}`}
      aria-label={`Ring ${name}, ${telefon}. ${KONTAKT_NOTIS}.`}
      title={KONTAKT_NOTIS}
      className={`items-center gap-2 rounded-lg border border-[var(--brand)]/35 bg-white font-semibold tabular-nums text-[var(--brand-ink)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--tint-1)] active:bg-[var(--tint-2)] ${
        stor ? "min-h-12 px-4 text-base" : "min-h-11 px-3.5 text-[15px]"
      } ${className || "inline-flex"}`}
    >
      <Phone className="size-4 shrink-0" aria-hidden />
      {telefon}
    </a>
  );
}

/**
 * Listan bär proveniensmärkningen överst — där ögat är när man ska ringa —
 * och förklaringen av "Utvald" i foten.
 */
export function CompanyCardList({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-muted)]">
        Telefonnummer och adresser kommer från ett register från {REGISTER_AR} och
        kan vara inaktuella.
      </p>
      <ol className="overflow-hidden rounded-xl border border-[var(--rule)] bg-white divide-y divide-[var(--rule-soft)]">
        {children}
      </ol>
      <p className="text-xs text-[var(--text-muted)]">
        <span className="font-semibold text-[var(--accent-cta-ink)]">Utvald · annons</span>{" "}
        betyder att företaget betalar för att synas först. Därefter kommer
        företag med komplett profil, sedan övriga efter antal anställda.
      </p>
    </div>
  );
}
