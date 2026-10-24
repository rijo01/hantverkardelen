import { telefontypText } from "@/lib/overlay-contract";
import type { OverlayProfilRow } from "@/lib/overlay-contract";
import { normalizeWebb, shortWebb } from "@/lib/foretag-format";

/**
 * Den betalda profilen — allt kunden köpt, i de delar företagssidan visar det:
 * "Om oss", "Tjänster", rutan "Kontakt" och rutan "Om märkningen".
 *
 * Visar ENBART det kunden själv lämnat: logotyp, egen beskrivning, sökord,
 * kategorier, hemsida och kontaktuppgifter. Ingen genererad text, inga betyg,
 * inga omdömen, inga påhittade "rekommenderas av"-formuleringar. Ett företag
 * som betalar för synlighet köper synlighet, inte ett omdöme vi hittat på åt
 * dem.
 *
 * `info_html` är redan saniterad när den skrevs (allowlist i
 * /api/overlay/publish, enligt kontraktet: p, br, strong, em, ul, li, a[href]),
 * och kan därför renderas som HTML här. Den saneras aldrig i CRM:et — sajten
 * litar inte på att avsändaren städat.
 */

/**
 * Etiketten bredvid numret. Sedan kontrakt 1.4 är `telefon_typ` fri text
 * ("Kundtjänst", "Lager") och skrivs ut som den är. Koden "kontakt" heter
 * "Direkt" här, som den alltid gjort på sajten; övriga gamla koder blir ord
 * via kontraktets telefontypText().
 */
function telefonEtikett(typ: string | null | undefined): string | null {
  if (typ?.trim() === "kontakt") return "Direkt";
  return telefontypText(typ);
}

/** Adressöverskrivning som en rad text, eller null om inget fält är satt. */
function adressrad(
  a: OverlayProfilRow["adress_override"] | null | undefined,
): string | null {
  if (!a || typeof a !== "object") return null;
  const { gata, postnummer, postort } = a as {
    gata?: string;
    postnummer?: string;
    postort?: string;
  };
  const rad = [gata, [postnummer, postort].filter(Boolean).join(" ")]
    .filter((d) => d && d.trim().length > 0)
    .join(", ");
  return rad.length > 0 ? rad : null;
}

export type BetaldProfil = {
  infoHtml: string | null;
  /** Kundens kategorier och sökord, i den ordningen, utan dubbletter. */
  tjanster: string[];
  hemsida: string | null;
  telefon: string | null;
  telefonEtikett: string | null;
  epost: string | null;
  kontaktperson: string | null;
  besok: string | null;
  post: string | null;
};

export function betaldProfil(overlay: OverlayProfilRow): BetaldProfil {
  const tjanster: string[] = [];
  const sedda = new Set<string>();
  for (const ord of [...(overlay.kategorier ?? []), ...(overlay.keywords ?? [])]) {
    const rent = ord.trim();
    if (!rent || sedda.has(rent.toLowerCase())) continue;
    sedda.add(rent.toLowerCase());
    tjanster.push(rent);
  }
  return {
    infoHtml: overlay.info_html?.trim() || null,
    tjanster,
    hemsida: normalizeWebb(overlay.hemsida),
    telefon: overlay.telefon_override?.trim() || null,
    telefonEtikett: telefonEtikett(overlay.telefon_typ),
    epost: overlay.epost_override?.trim() || null,
    kontaktperson: overlay.kontaktperson?.trim() || null,
    // Post- och besöksadress var för sig (1.1). Faller tillbaka på den odelade
    // adress_override från 1.0 när de nya fälten saknas.
    besok: adressrad(overlay.adress_override_besok) ?? adressrad(overlay.adress_override),
    post: adressrad(overlay.adress_override_post),
  };
}

/** Sätts för ?preview= — då är detta ett utkast, inte något som ligger live. */
export function UtkastBanner() {
  return (
    <p className="bg-navy px-5 py-3 text-[15px] font-semibold text-white">
      Förhandsvisning — så här kommer profilen att se ut. Ingen ser den här
      sidan förrän ordern godkänns.
    </p>
  );
}

/** Höger spalt i betalt läge: kundens egna kontaktuppgifter. */
export function KontaktRuta({
  profil,
  omrade,
}: {
  profil: BetaldProfil;
  /** Kommun och län — var företaget finns enligt registret. */
  omrade: string | null;
}) {
  const rader: Array<{ etikett: string; varde: React.ReactNode }> = [];
  if (profil.kontaktperson) rader.push({ etikett: "Kontaktperson", varde: profil.kontaktperson });
  if (profil.telefon) {
    rader.push({
      etikett: profil.telefonEtikett ? `Telefon · ${profil.telefonEtikett}` : "Telefon",
      varde: (
        <a href={`tel:${profil.telefon.replace(/\s+/g, "")}`} className="sg-link tabular-nums">
          {profil.telefon}
        </a>
      ),
    });
  }
  if (profil.hemsida) {
    rader.push({
      etikett: "Hemsida",
      varde: (
        <a href={profil.hemsida} target="_blank" rel="noopener noreferrer" className="sg-link break-all">
          {shortWebb(profil.hemsida) ?? profil.hemsida}
        </a>
      ),
    });
  }
  if (profil.epost) {
    rader.push({
      etikett: "E-post",
      varde: (
        <a href={`mailto:${profil.epost}`} className="sg-link break-all">
          {profil.epost}
        </a>
      ),
    });
  }
  if (profil.besok) rader.push({ etikett: "Besöksadress", varde: profil.besok });
  if (profil.post) rader.push({ etikett: "Postadress", varde: profil.post });
  if (omrade) rader.push({ etikett: "Område", varde: omrade });

  if (rader.length === 0) return null;
  return (
    <section className="sg-panel p-5">
      <h2 className="sg-label">Kontakt</h2>
      <dl className="mt-3 divide-y divide-line-soft">
        {rader.map((r) => (
          <div key={r.etikett} className="py-2.5">
            <dt className="text-[13px] text-ink-3">{r.etikett}</dt>
            <dd className="mt-0.5 text-[15px] font-medium text-ink">{r.varde}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Vad märkningen betyder. "Syns först i listorna" står bara när det är sant:
 * det är `featured` som lyfter raden, inte profilen i sig.
 */
export function OmMarkningen({ featured }: { featured: boolean }) {
  return (
    <section className="sg-panel border-t-4 border-t-signal p-5">
      <h2 className="sg-label">Om märkningen</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
        Företaget betalar för en utökad profil{featured ? " och syns först i listorna" : ""}.
        Texten och bilderna kommer från företaget själv. Det är inget betyg.
      </p>
    </section>
  );
}
