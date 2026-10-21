import Link from "next/link";
import { Filter, X } from "lucide-react";
import { ALL_KOMMUNER } from "@/lib/kommuner";
import { TOP_BRANSCHER } from "@/lib/stats";
import { yrkesnamn } from "@/lib/yrkesnamn";
import { REGISTER_AR } from "@/lib/dataprovenans";

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
 * URL-driven filter-sidopanel. Server-rendered — varje val är en Link
 * som behåller övriga params. På mobil viks panelen ihop i en <details>.
 *
 * Aeant-buckets: tomma till stora (Hitta.se-stil). Bara filter som funkar
 * mot faktisk data — vi visar t.ex. inte F-skatt, omsättning eller
 * registrår eftersom de inte finns i `foretag_publik`.
 */
export function FilterPanel({
  state,
  pathname,
  totalCount,
}: {
  state: FilterState;
  pathname: string;
  totalCount?: number;
}) {
  const hasAnyFilter = Boolean(
    state.kommun ||
      state.bransch ||
      state.aeantMin ||
      state.aeantMax,
  );

  const sizeBuckets: Array<{
    label: string;
    min?: string;
    max?: string;
    icon?: React.ReactNode;
  }> = [
    { label: "Alla storlekar" },
    { label: "1–9 anställda", min: "1", max: "9" },
    { label: "10–49 anställda", min: "10", max: "49" },
    { label: "50–249 anställda", min: "50", max: "249" },
    { label: "250+ anställda", min: "250" },
  ];

  return (
    <aside aria-label="Filtrera resultat">
      {/* Mobile: collapsible drawer */}
      <details className="overflow-hidden rounded-xl border border-[var(--rule)] bg-white lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-sm font-semibold text-[var(--text-strong)]">
          <span className="inline-flex items-center gap-2">
            <Filter className="size-4 text-[var(--brand-2)]" aria-hidden />
            Filter
            {hasAnyFilter && (
              <span className="rounded-sm bg-[var(--tint-2)] px-1.5 py-0.5 text-xs font-semibold text-[var(--brand-ink)]">
                Aktivt
              </span>
            )}
          </span>
          <span
            aria-hidden
            className="inline-flex size-6 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-muted)] transition-transform [details[open]_&]:rotate-45"
          >
            +
          </span>
        </summary>
        <div className="border-t border-[var(--rule-soft)] p-4">
          <FilterBody
            state={state}
            pathname={pathname}
            sizeBuckets={sizeBuckets}
            totalCount={totalCount}
            hasAnyFilter={hasAnyFilter}
          />
        </div>
      </details>

      {/* Desktop: sticky panel */}
      <div className="hidden lg:block">
        <div className="sticky top-20 overflow-hidden rounded-xl border border-[var(--rule)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--rule-soft)] px-5 py-4">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
              <Filter className="size-4 text-[var(--brand-2)]" aria-hidden />
              Filter
            </h2>
            {hasAnyFilter && (
              <Link
                href={buildHref(pathname, state, {
                kommun: null,
                lan: null,
                postort: null,
                bransch: null,
                aeantMin: null,
                aeantMax: null,
                page: null,
              })}
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--brand-ink)]"
              >
                Rensa
                <X className="size-3" aria-hidden />
              </Link>
            )}
          </div>
          <div className="px-5 py-5">
            <FilterBody
              state={state}
              pathname={pathname}
              sizeBuckets={sizeBuckets}
              totalCount={totalCount}
              hasAnyFilter={hasAnyFilter}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

function FilterBody({
  state,
  pathname,
  sizeBuckets,
  totalCount,
  hasAnyFilter,
}: {
  state: FilterState;
  pathname: string;
  sizeBuckets: Array<{ label: string; min?: string; max?: string }>;
  totalCount?: number;
  hasAnyFilter: boolean;
}) {
  return (
    <div className="space-y-6">
      {totalCount !== undefined && (
        <p className="text-sm text-[var(--text-muted)]">
          {totalCount.toLocaleString("sv-SE")} träffar
        </p>
      )}

      <FilterGroup
        title="Antal anställda"
      >
        <ul className="space-y-0.5">
          {sizeBuckets.map((b) => {
            const isActive =
              (state.aeantMin ?? "") === (b.min ?? "") &&
              (state.aeantMax ?? "") === (b.max ?? "");
            return (
              <li key={b.label}>
                <Link
                  href={buildHref(pathname, state, {
                    aeantMin: b.min ?? null,
                    aeantMax: b.max ?? null,
                  })}
                  aria-current={isActive ? "true" : undefined}
                  className={`flex min-h-10 items-center justify-between rounded-lg px-2 text-sm transition ${
                    isActive
                      ? "bg-[var(--tint-2)] font-semibold text-[var(--brand-ink)]"
                      : "text-[var(--text-body)] hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  <span>{b.label}</span>

                </Link>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      <FilterGroup
        title="Bransch"
      >
        <ul className="space-y-0.5">
          <li>
            <Link
              href={buildHref(pathname, state, { bransch: null })}
              aria-current={!state.bransch ? "true" : undefined}
              className={`flex min-h-10 items-center justify-between rounded-lg px-2 text-sm transition ${
                !state.bransch
                  ? "bg-[var(--tint-2)] font-semibold text-[var(--brand-ink)]"
                  : "text-[var(--text-body)] hover:bg-[var(--surface-soft)]"
              }`}
            >
              Alla yrken

            </Link>
          </li>
          {TOP_BRANSCHER.slice(0, 10).map((b) => {
            const isActive = state.bransch === String(b.id);
            return (
              <li key={b.id}>
                <Link
                  href={buildHref(pathname, state, { bransch: String(b.id) })}
                  aria-current={isActive ? "true" : undefined}
                  className={`flex min-h-10 items-center justify-between gap-2 rounded-lg px-2 text-sm transition ${
                    isActive
                      ? "bg-[var(--tint-2)] font-semibold text-[var(--brand-ink)]"
                      : "text-[var(--text-body)] hover:bg-[var(--surface-soft)]"
                  }`}
                  title={yrkesnamn(b.id, b.name)}
                >
                  <span className="truncate">{yrkesnamn(b.id, b.name)}</span>

                </Link>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      <FilterGroup
        title="Kommun"
      >
        <form action={pathname} method="GET" className="space-y-2">
          {/* Behåll övriga params via hidden inputs. Vi släpper lan/postort
              här — att välja en specifik kommun ska medvetet smala in från
              ett bredare län-/postort-filter (kommun > postort > lan mutex).
              Kategori bevaras däremot — kategori-browse ska kunna kombineras
              med kommun-val. */}
          {state.q && <input type="hidden" name="q" value={state.q} />}
          {state.kategori && (
            <input type="hidden" name="kategori" value={state.kategori} />
          )}
          {state.bransch && (
            <input type="hidden" name="bransch" value={state.bransch} />
          )}
          {state.aeantMin && (
            <input type="hidden" name="aeantMin" value={state.aeantMin} />
          )}
          {state.aeantMax && (
            <input type="hidden" name="aeantMax" value={state.aeantMax} />
          )}
          <select
            name="kommun"
            defaultValue={state.kommun ?? ""}
            className="min-h-10 w-full rounded-lg border border-[var(--rule-strong)] bg-white px-2.5 py-2 text-sm text-[var(--text-strong)] shadow-[0_1px_2px_rgba(17,24,28,0.03)] outline-none transition focus:border-[var(--brand-2)]/60 focus:ring-2 focus:ring-[var(--brand-2)]/15"
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
          <button
            type="submit"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[var(--brand)]/35 bg-white text-sm font-semibold text-[var(--brand-ink)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--tint-1)]"
          >
            Visa kommunen
          </button>
        </form>
      </FilterGroup>

      {hasAnyFilter && (
        <div className="lg:hidden">
          <Link
            href={pathname + (state.q ? `?q=${encodeURIComponent(state.q)}` : "")}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--rule)] bg-white py-2 text-xs font-semibold text-[var(--text-body)] transition hover:border-[var(--brand-2)]/40 hover:text-[var(--brand-ink)]"
          >
            <X className="size-3.5" aria-hidden />
            Rensa filter
          </Link>
        </div>
      )}

      <p className="text-xs leading-relaxed text-[var(--text-muted)]">
        Uppgifterna kommer från ett offentligt näringslivsregister från omkring{" "}
        {REGISTER_AR}. Personnummer för enskilda firmor visas aldrig.
      </p>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="pb-1 text-sm font-semibold text-[var(--text-strong)]">
        {title}
      </legend>
      {children}
    </fieldset>
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
