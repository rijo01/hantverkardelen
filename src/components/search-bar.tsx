"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Search, MapPin, Building2, Layers } from "lucide-react";
import { ALL_KOMMUNER, kommunBySlug } from "@/lib/kommuner";
import { ALL_LAN, lanBySlug } from "@/lib/lan";
import { ALL_POSTORTER } from "@/lib/postorter";
import {
  SNABBVAL,
  kategoriNamn,
  kombinationsforslag,
  parametrarFor,
  tolkaSokfraga,
} from "@/lib/sokfraga";

type Suggestion = {
  type: "foretag" | "kommun" | "bransch" | "kombination";
  label: string;
  sub: string;
  href: string;
};

type OrtSuggestion =
  | { type: "lan"; slug: string; label: string; sub: string }
  | { type: "kommun"; slug: string; label: string; sub: string }
  | { type: "postort"; value: string; label: string; sub: string };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function iconFor(type: Suggestion["type"]) {
  if (type === "kommun") return MapPin;
  if (type === "bransch") return Layers;
  if (type === "kombination") return Search;
  return Building2;
}

/**
 * Ortfältets text → en sökparameter. Kommun först: "Uppsala" betyder i regel
 * kommunen, och det är kommunens yrkessidor besökaren landar på. Ett län nås
 * genom att skriva "Uppsala län" eller välja det i listan.
 */
function ortParam(ortRaw: string): [string, string] | null {
  const ort = ortRaw.trim();
  if (!ort) return null;
  const lanMatch = ort.match(/^(.+?)s?\s+län$/i);
  if (lanMatch) {
    const lan = lanBySlug(slugify(lanMatch[1]));
    if (lan) return ["lan", lan.slug];
  }
  const slug = slugify(ort);
  const kommun = kommunBySlug(slug);
  if (kommun) return ["kommun", kommun.slug];
  const lan = lanBySlug(slug);
  if (lan) return ["lan", lan.slug];
  return ["postort", ort];
}

export function SearchBar({
  variant = "compact",
  initialValue,
  preserveFilters = false,
  snabbval = false,
  initialOrt,
  kompakt = false,
  params = {},
}: {
  /**
   * "compact" — en rad i sidhuvudet (bara desktop, se site-nav.tsx).
   * "dual"    — startsidan och /sok: två fält med synliga etiketter.
   */
  variant?: "compact" | "dual";
  initialValue?: string;
  preserveFilters?: boolean;
  /** Visa snabbvalen för de vanligaste yrkena under rutan. */
  snabbval?: boolean;
  /** Förifylld ort, t.ex. kommunen på en kommunsida. */
  initialOrt?: string;
  /**
   * Lägre ruta på mobil: ort och Sök på samma rad. För sidor där träffarna,
   * inte sökrutan, ska fylla första skärmen (/sok).
   */
  kompakt?: boolean;
  /**
   * Sidans sökparametrar (q, kategori, kommun, lan, postort, bransch), när
   * sidan har några. Skickas som props i stället för useSearchParams(): den
   * kroken kräver en Suspense-gräns, och då renderades rutan först i
   * webbläsaren och knuffade ner sidan (CLS 0,26 på startsidan).
   */
  params?: Readonly<Record<string, string | undefined>>;
}) {
  const router = useRouter();
  const searchParams = { get: (k: string) => params[k] ?? null };
  const listId = useId();
  const qId = useId();
  const ortId = useId();

  const [q, setQ] = useState(() => {
    if (initialValue) return initialValue;
    const fraga = searchParams.get("q");
    if (fraga) return fraga;
    // En tolkad fråga ("elektriker kungälv") landar som ?kategori=el — visa
    // yrket i fältet igen så att besökaren ser vad som söktes.
    const kategori = searchParams.get("kategori");
    return kategori ? kategoriNamn(kategori) : "";
  });
  const [ort, setOrt] = useState<string>(() => {
    if (initialOrt) return initialOrt;
    const lan = searchParams.get("lan");
    if (lan) {
      const match = lanBySlug(lan);
      if (match) return `${match.name}s län`;
    }
    const postort = searchParams.get("postort");
    if (postort) return postort;
    const k = searchParams.get("kommun");
    if (k) {
      const match = kommunBySlug(k);
      if (match) return match.name;
    }
    return "";
  });
  const [pending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [ortSuggestions, setOrtSuggestions] = useState<OrtSuggestion[]>([]);
  const [showOrtSuggestions, setShowOrtSuggestions] = useState(false);
  const [ortActiveIndex, setOrtActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const qRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stäng dropdowns vid klick utanför hela sökformuläret
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setShowOrtSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Ortförslag — helt i minnet (ingen nätverkstrafik, ingen debounce).
  // Kommun > län > postort, med tak per grupp.
  useEffect(() => {
    const needle = ort.trim().toLowerCase();
    if (needle.length < 1) {
      setOrtSuggestions([]);
      setOrtActiveIndex(-1);
      return;
    }

    const kommunMatches: OrtSuggestion[] = ALL_KOMMUNER
      .filter((k) => k.name.toLowerCase().startsWith(needle))
      .slice(0, 5)
      .map((k) => ({
        type: "kommun" as const,
        slug: k.slug,
        label: k.name,
        sub: "Kommun",
      }));

    const lanMatches: OrtSuggestion[] = ALL_LAN
      .filter((l) => l.name.toLowerCase().startsWith(needle))
      .slice(0, 2)
      .map((l) => ({
        type: "lan" as const,
        slug: l.slug,
        label: `${l.name}s län`,
        sub: "Län",
      }));

    const postortMatches: OrtSuggestion[] = ALL_POSTORTER
      .filter((p) => p.toLowerCase().startsWith(needle))
      .filter((p) => !kommunMatches.some((k) => k.label === p))
      .slice(0, 4)
      .map((p) => ({
        type: "postort" as const,
        value: p,
        label: p,
        sub: "Ort",
      }));

    setOrtSuggestions([...kommunMatches, ...lanMatches, ...postortMatches]);
    setOrtActiveIndex(-1);
  }, [ort]);

  // "Yrke i Ort" räknas fram lokalt och står först i listan. API:t förstår
  // inte två ord, så utan detta var dropdownen tom för just "elektriker kung".
  const kombinationer: Suggestion[] = useMemo(
    () =>
      kombinationsforslag(q).map((k) => ({
        type: "kombination" as const,
        label: k.label,
        sub: "Yrke och ort",
        href: k.href,
      })),
    [q],
  );

  // Debouncad hämtning av företag, kommuner och branscher
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setSuggestions([]);
      setLoadingSuggest(false);
      return;
    }
    setLoadingSuggest(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/suggest?q=${encodeURIComponent(needle)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error("suggest failed");
        const data: { suggestions: Suggestion[] } = await res.json();
        setSuggestions(data.suggestions ?? []);
        setActiveIndex(-1);
      } catch {
        // tyst
      } finally {
        if (!ctrl.signal.aborted) setLoadingSuggest(false);
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const allaForslag = useMemo(
    () => [...kombinationer, ...suggestions],
    [kombinationer, suggestions],
  );

  const goToSearch = useCallback(
    (rawQ: string, rawOrt: string) => {
      const query = rawQ.trim();
      const ortRaw = rawOrt.trim();

      // "elektriker kungälv" i ett fält, eller "elektriker" + "Kungälv" i två:
      // gå direkt till yrket i orten. Samma tolkning görs på servern för den
      // som skriver adressen själv — se sok/page.tsx.
      const tolkning = query ? tolkaSokfraga(query) : null;
      const tolkat = tolkning ? parametrarFor(tolkning) : null;
      const params = tolkat ?? new URLSearchParams();
      if (!tolkat && query) params.set("q", query);
      if (!tolkning?.ort) {
        const geo = ortParam(ortRaw);
        if (geo) params.set(geo[0], geo[1]);
      }

      if (preserveFilters) {
        const bransch = searchParams.get("bransch");
        if (bransch && !params.has("bransch") && !params.has("kategori")) {
          params.set("bransch", bransch);
        }
      }

      if (!params.toString()) {
        qRef.current?.focus();
        return;
      }
      setShowSuggestions(false);
      startTransition(() => router.push(`/sok?${params.toString()}`));
    },
    [router, params, preserveFilters],
  );

  const goToKategori = useCallback(
    (kategori: string) => {
      const params = new URLSearchParams({ kategori });
      const geo = ortParam(ort);
      if (geo) params.set(geo[0], geo[1]);
      startTransition(() => router.push(`/sok?${params.toString()}`));
    },
    [ort, router],
  );

  const goToSuggestion = useCallback(
    (s: Suggestion) => {
      setShowSuggestions(false);
      startTransition(() => router.push(s.href));
    },
    [router],
  );

  const pickOrt = useCallback(
    (s: OrtSuggestion) => {
      let displayName: string;
      let geo: [string, string];
      if (s.type === "lan") {
        geo = ["lan", s.slug];
        displayName = s.label;
      } else if (s.type === "kommun") {
        geo = ["kommun", s.slug];
        displayName = s.label;
      } else {
        geo = ["postort", s.value];
        displayName = s.value;
      }
      setShowOrtSuggestions(false);
      setOrt(displayName);
      // Inget yrke ifyllt ännu: stanna i formuläret. Att välja ort är halva
      // frågan, och en lista med alla yrken i orten är inte vad man bad om.
      if (q.trim().length < 2) {
        qRef.current?.focus();
        return;
      }
      const tolkning = tolkaSokfraga(q);
      const params = parametrarFor({ ...tolkning, ort: null }) ?? new URLSearchParams({ q: q.trim() });
      params.set(geo[0], geo[1]);
      startTransition(() => router.push(`/sok?${params.toString()}`));
    },
    [q, router],
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (activeIndex >= 0 && allaForslag[activeIndex]) {
      goToSuggestion(allaForslag[activeIndex]);
      return;
    }
    goToSearch(q, ort);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || allaForslag.length === 0) {
      if (e.key === "ArrowDown") {
        setShowSuggestions(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % allaForslag.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? allaForslag.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  function onOrtKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showOrtSuggestions || ortSuggestions.length === 0) {
      if (e.key === "ArrowDown") {
        setShowOrtSuggestions(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOrtActiveIndex((i) => (i + 1) % ortSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOrtActiveIndex((i) => (i <= 0 ? ortSuggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && ortActiveIndex >= 0) {
      e.preventDefault();
      const picked = ortSuggestions[ortActiveIndex];
      if (picked) pickOrt(picked);
    } else if (e.key === "Escape") {
      setShowOrtSuggestions(false);
    }
  }

  const dropdownVisible =
    showSuggestions &&
    q.trim().length >= 2 &&
    (allaForslag.length > 0 || loadingSuggest);

  const dropdown = useMemo(() => {
    if (!dropdownVisible) return null;
    return (
      <div
        id={listId}
        role="listbox"
        className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[var(--rule)] bg-white shadow-[0_16px_40px_-16px_rgba(17,24,38,0.25)]"
      >
        {loadingSuggest && allaForslag.length === 0 ? (
          <div className="space-y-2 p-3">
            <div className="rd-skeleton h-4 w-3/5 rounded" />
            <div className="rd-skeleton h-4 w-4/5 rounded" />
            <div className="rd-skeleton h-4 w-2/3 rounded" />
          </div>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {allaForslag.map((s, i) => {
              const Icon = iconFor(s.type);
              const active = i === activeIndex;
              return (
                <li key={`${s.type}-${s.href}-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      goToSuggestion(s);
                    }}
                    className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                      active ? "bg-[var(--tint-2)]" : "hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    <Icon
                      className={`size-4 shrink-0 ${
                        s.type === "kombination" ? "text-[var(--brand)]" : "text-[var(--text-dim)]"
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm text-[var(--text-strong)] ${
                          s.type === "kombination" ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {s.label}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-[var(--text-dim)]">{s.sub}</span>
                  </button>
                </li>
              );
            })}
            <li className="border-t border-[var(--rule-soft)]">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  goToSearch(q, ort);
                }}
                className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-soft)]"
              >
                <Search className="size-4 shrink-0 text-[var(--text-dim)]" aria-hidden />
                <span>
                  Sök efter{" "}
                  <span className="font-medium text-[var(--text-strong)]">
                    &ldquo;{q.trim()}&rdquo;
                  </span>
                </span>
              </button>
            </li>
          </ul>
        )}
      </div>
    );
  }, [
    dropdownVisible,
    loadingSuggest,
    allaForslag,
    activeIndex,
    listId,
    q,
    ort,
    goToSearch,
    goToSuggestion,
  ]);

  const ortDropdownVisible =
    showOrtSuggestions && ort.trim().length >= 1 && ortSuggestions.length > 0;

  const ortDropdown = useMemo(() => {
    if (!ortDropdownVisible) return null;
    return (
      <div
        role="listbox"
        className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[var(--rule)] bg-white shadow-[0_16px_40px_-16px_rgba(17,24,38,0.25)]"
      >
        <ul className="max-h-[60vh] overflow-y-auto py-1">
          {ortSuggestions.map((s, i) => {
            const active = i === ortActiveIndex;
            const key = s.type === "postort" ? `postort-${s.value}-${i}` : `${s.type}-${s.slug}-${i}`;
            return (
              <li key={key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setOrtActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickOrt(s);
                  }}
                  className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                    active ? "bg-[var(--tint-2)]" : "hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  <MapPin className="size-4 shrink-0 text-[var(--text-dim)]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-strong)]">
                    {s.label}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--text-dim)]">{s.sub}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }, [ortDropdownVisible, ortSuggestions, ortActiveIndex, pickOrt]);

  const qInput = (className: string, placeholder: string) => (
    <input
      ref={qRef}
      id={qId}
      type="search"
      name="q"
      value={q}
      onChange={(e) => {
        setQ(e.target.value);
        setShowSuggestions(true);
      }}
      onFocus={() => {
        setShowSuggestions(true);
        setShowOrtSuggestions(false);
      }}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="next"
      role="combobox"
      aria-autocomplete="list"
      aria-controls={dropdownVisible ? listId : undefined}
      aria-expanded={dropdownVisible}
      className={className}
    />
  );

  const ortInput = (className: string, placeholder: string) => (
    <input
      id={ortId}
      type="text"
      name="ort"
      value={ort}
      onChange={(e) => {
        setOrt(e.target.value);
        setShowOrtSuggestions(true);
      }}
      onFocus={() => {
        setShowOrtSuggestions(true);
        setShowSuggestions(false);
      }}
      onKeyDown={onOrtKeyDown}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="search"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={ortDropdownVisible}
      className={className}
    />
  );

  // === COMPACT — en rad i sidhuvudet (lg+) ===
  if (variant === "compact") {
    return (
      <div ref={wrapRef} className="relative w-full max-w-lg">
        <form
          onSubmit={onSubmit}
          role="search"
          aria-label="Sök hantverkare"
          className="rd-search-box flex h-10 w-full items-center rounded-lg border border-[var(--rule-strong)] bg-white"
        >
          <label className="relative flex min-w-0 flex-[1.3] items-center">
            <span className="sr-only">Vad behöver du hjälp med?</span>
            <Search aria-hidden className="absolute left-3 size-4 text-[var(--text-dim)]" />
            {qInput(
              "h-full w-full bg-transparent pl-9 pr-2 text-sm text-[var(--text-strong)] focus:outline-none",
              "Yrke eller företag",
            )}
          </label>
          <div aria-hidden className="h-5 w-px bg-[var(--rule)]" />
          <label className="relative flex min-w-0 flex-1 items-center">
            <span className="sr-only">Var?</span>
            {ortInput(
              "h-full w-full bg-transparent px-3 text-sm text-[var(--text-strong)] focus:outline-none",
              "Kommun eller ort",
            )}
            {ortDropdown}
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rd-btn-primary m-1 inline-flex h-8 shrink-0 items-center rounded-md px-3.5 text-sm font-semibold"
          >
            {pending ? "Söker…" : "Sök"}
          </button>
        </form>
        {dropdown}
      </div>
    );
  }

  // === DUAL — startsidan och /sok ===
  return (
    <div className="w-full">
      <div ref={wrapRef} className="relative w-full">
        <form
          onSubmit={onSubmit}
          role="search"
          aria-label="Sök hantverkare"
          className={`rd-search-box grid w-full overflow-visible rounded-xl border border-[var(--rule-strong)] bg-white sm:grid-cols-[1.4fr_1fr_auto] ${
            kompakt ? "grid-cols-[1fr_auto]" : "grid-cols-1"
          }`}
        >
          <div className={`relative px-4 pb-2 sm:pb-2.5 sm:pt-3 ${kompakt ? "col-span-2 pt-2 sm:col-span-1" : "pt-3"}`}>
            <label htmlFor={qId} className="block text-[13px] font-semibold text-[var(--text-strong)]">
              Vad behöver du hjälp med?
            </label>
            {qInput(
              "mt-0.5 h-9 w-full bg-transparent text-base text-[var(--text-strong)] focus:outline-none",
              "Elektriker, målare, VVS …",
            )}
          </div>
          <div className={`relative border-t border-[var(--rule)] px-4 pb-2 sm:border-l sm:border-t-0 sm:pb-2.5 sm:pt-3 ${kompakt ? "pt-2" : "pt-3"}`}>
            <label htmlFor={ortId} className="block text-[13px] font-semibold text-[var(--text-strong)]">
              Var?
            </label>
            {ortInput(
              "mt-0.5 h-9 w-full bg-transparent text-base text-[var(--text-strong)] focus:outline-none",
              "Kommun eller ort",
            )}
            {ortDropdown}
          </div>
          <div className={`p-2 sm:pl-0 ${kompakt ? "border-t border-[var(--rule)] sm:border-t-0" : ""}`}>
            <button
              type="submit"
              disabled={pending}
              className={`rd-btn-primary inline-flex w-full items-center justify-center gap-2 rounded-lg text-base font-semibold sm:h-full sm:min-h-14 sm:px-7 ${
                kompakt ? "h-full min-h-12 px-5" : "h-12 px-7"
              }`}
            >
              <Search aria-hidden className="size-5" />
              {pending ? "Söker…" : "Sök"}
            </button>
          </div>
        </form>
        {dropdown}
      </div>

      {snabbval && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-[var(--text-muted)]">Vanliga yrken:</span>
          {SNABBVAL.map((s) => (
            <button
              key={s.kategori}
              type="button"
              onClick={() => goToKategori(s.kategori)}
              className="inline-flex min-h-10 items-center rounded-lg border border-[var(--rule)] bg-white px-3 text-sm font-medium text-[var(--text-body)] transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--tint-1)] hover:text-[var(--brand-ink)]"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
