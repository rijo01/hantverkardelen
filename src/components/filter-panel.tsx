import { ALL_KOMMUNER, type Kommun } from "@/lib/kommuner";
import { HANTVERK_KATEGORIER } from "@/lib/hantverk-kategorier";
import { KOMMUN_BRANSCH_FORETAG } from "@/lib/seo-snapshot";
import { kategoriNamn } from "@/lib/sokfraga";
import { REGISTER_AR } from "@/lib/dataprovenans";
import { LankLista, SidoRuta, StorlekVal } from "@/components/resultat-vy";

export type FilterState = {
  q?: string;
  kategori?: string;
  kommun?: string;
  lan?: string;
  postort?: string;
  bransch?: string;
  aeantMin?: string;
  aeantMax?: string;
  page?: string;
};

/**
 * Sökets sidospalt. Server-renderad — varje val är en länk som behåller
 * övriga parametrar.
 *
 * Bara filter som fungerar mot faktisk data: storlek (aeant) och ort. Antalen
 * i länklistorna kommer ur registrets snapshot (seo-snapshot.ts), summerade
 * över yrkets branschkoder — inga uppskattningar.
 */
export function sokSidospalt({
  state,
  pathname,
  kommun,
}: {
  state: FilterState;
  pathname: string;
  kommun?: Kommun;
}): { overst: React.ReactNode; under: React.ReactNode } {
  const storlekar: Array<{ label: string; min?: string; max?: string }> = [
    { label: "Alla" },
    { label: "1–9", min: "1", max: "9" },
    { label: "10–49", min: "10", max: "49" },
    { label: "50–249", min: "50", max: "249" },
    { label: "250+", min: "250" },
  ];

  const overst = (
    <StorlekVal
      val={storlekar.map((b) => ({
        label: b.label,
        href: buildHref(pathname, state, {
          aeantMin: b.min ?? null,
          aeantMax: b.max ?? null,
          page: null,
        }),
        aktiv:
          (state.aeantMin ?? "") === (b.min ?? "") &&
          (state.aeantMax ?? "") === (b.max ?? ""),
      }))}
    />
  );

  const kategori = state.kategori
    ? HANTVERK_KATEGORIER.find((k) => k.slug === state.kategori)
    : undefined;
  const iKommun = (kod: string, ng1: readonly number[]) =>
    ng1.reduce((sum, n) => sum + (KOMMUN_BRANSCH_FORETAG[kod]?.[n] ?? 0), 0);

  // Samma yrke i länets andra kommuner. Grannskapsdata finns inte; länet är
  // det ärliga närmevärdet (samma regel som kommunsidorna).
  const naromrade =
    kommun && kategori
      ? ALL_KOMMUNER.filter((k) => k.lan === kommun.lan && k.code !== kommun.code)
          .map((k) => ({ k, n: iKommun(k.code, kategori.ng1) }))
          .filter(({ n }) => n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, 8)
          .map(({ k, n }) => ({
            href: `/sok?kategori=${kategori.slug}&kommun=${k.slug}`,
            label: k.name,
            antal: n,
          }))
      : [];

  // Andra yrken i orten, eller i hela landet när ingen kommun är vald.
  const andraYrken = HANTVERK_KATEGORIER.filter((k) => k.slug !== kategori?.slug)
    .map((k) => ({ k, n: kommun ? iKommun(kommun.code, k.ng1) : k.count }))
    .filter(({ n }) => n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8)
    .map(({ k, n }) => ({
      href: `/sok?kategori=${k.slug}${kommun ? `&kommun=${kommun.slug}` : ""}`,
      label: kategoriNamn(k.slug),
      antal: n,
    }));

  const under = (
    <>
      {kategori && kommun && (
        <LankLista rubrik={`${kategoriNamn(kategori.slug)} i närheten`} lankar={naromrade} />
      )}
      {!kommun && <KommunVal state={state} pathname={pathname} />}
      <LankLista
        rubrik={kommun ? `Andra yrken i ${kommun.name}` : "Andra yrken"}
        lankar={andraYrken}
        sist={kommun ? { href: `/kommun/${kommun.slug}`, label: `Alla hantverkare i ${kommun.name}` } : undefined}
      />
      <p className="px-1 text-xs leading-relaxed text-ink-3">
        Uppgifterna kommer från ett offentligt näringslivsregister från omkring{" "}
        {REGISTER_AR}. Personnummer för enskilda firmor visas aldrig.
      </p>
    </>
  );

  return { overst, under };
}

/** Välj kommun — ett vanligt GET-formulär, fungerar utan JavaScript. */
function KommunVal({ state, pathname }: { state: FilterState; pathname: string }) {
  return (
    <SidoRuta rubrik="Kommun">
      <form action={pathname} method="GET" className="space-y-2">
        {/* Behåll övriga params via hidden inputs. Vi släpper lan/postort
            här — att välja en specifik kommun ska medvetet smala in från
            ett bredare län-/postort-filter (kommun > postort > lan mutex).
            Kategori bevaras däremot — kategori-browse ska kunna kombineras
            med kommun-val. */}
        {state.q && <input type="hidden" name="q" value={state.q} />}
        {state.kategori && <input type="hidden" name="kategori" value={state.kategori} />}
        {state.bransch && <input type="hidden" name="bransch" value={state.bransch} />}
        {state.aeantMin && <input type="hidden" name="aeantMin" value={state.aeantMin} />}
        {state.aeantMax && <input type="hidden" name="aeantMax" value={state.aeantMax} />}
        <label className="sr-only" htmlFor="kommunval">
          Kommun
        </label>
        <select
          id="kommunval"
          name="kommun"
          defaultValue={state.kommun ?? ""}
          className="min-h-11 w-full rounded-none border border-line bg-white px-2.5 text-[15px] text-ink"
        >
          <option value="">Alla kommuner</option>
          {ALL_KOMMUNER.slice()
            .sort((a, b) => a.name.localeCompare(b.name, "sv"))
            .map((k) => (
              <option key={k.slug} value={k.slug}>
                {k.name}
              </option>
            ))}
        </select>
        <button type="submit" className="sg-btn sg-btn-outline w-full text-[15px]">
          Visa kommunen
        </button>
      </form>
    </SidoRuta>
  );
}

export function buildHref(
  pathname: string,
  current: FilterState,
  overrides: Partial<Record<keyof FilterState, string | null>>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current } as Record<string, string | undefined>;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) merged[k] = undefined;
    else merged[k] = v;
  }
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
