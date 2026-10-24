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
  params = {},
}: {
  /**
   * "compact" — sidhuvudet på alla sidor utom startsidan (se site-nav.tsx).
   *             En rad från md; på mobil yrke överst, ort och Sök under.
   * "dual"    — startsidans hero: två fält med synliga etiketter.
   */
  variant?: "compact" | "dual";
  initialValue?: string;
  preserveFilters?: boolean;
  /** Visa snabbvalen för de vanligaste yrkena under rutan (på navy). */
  snabbval?: boolean;
  /** Förifylld ort, t.ex. kommunen på en kommunsida. */
  initialOrt?: string;
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
        className="absolute left-0 right-0 top-full z-50 mt-1 border border-line bg-white text-left"
      >
        {loadingSuggest && allaForslag.length === 0 ? (
          <div className="space-y-2 p-3">
            <div className="sg-skeleton h-4 w-3/5" />
            <div className="sg-skeleton h-4 w-4/5" />
            <div className="sg-skeleton h-4 w-2/3" />
          </div>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto">
            {allaForslag.map((s, i) => {
              const Icon = iconFor(s.type);
              const active = i === activeIndex;
              return (
                <li key={`${s.type}-${s.href}-${i}`} className="border-b border-line-soft">
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
                      active ? "bg-line-soft" : "hover:bg-page"
                    }`}
                  >
                    <Icon
                      className={`size-4 shrink-0 ${s.type === "kombination" ? "text-navy" : "text-ink-3"}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[15px] text-ink ${
                          s.type === "kombination" ? "font-bold" : "font-medium"
                        }`}
                      >
                        {s.label}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-3">{s.sub}</span>
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  goToSearch(q, ort);
                }}
                className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm text-ink-2 transition-colors hover:bg-page"
              >
                <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span>
                  Sök efter{" "}
                  <span className="font-semibold text-ink">&ldquo;{q.trim()}&rdquo;</span>
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
        className="absolute left-0 right-0 top-full z-50 mt-1 border border-line bg-white text-left"
      >
        <ul className="max-h-[60vh] overflow-y-auto">
          {ortSuggestions.map((s, i) => {
            const active = i === ortActiveIndex;
            const key = s.type === "postort" ? `postort-${s.value}-${i}` : `${s.type}-${s.slug}-${i}`;
            return (
              <li key={key} className="border-b border-line-soft last:border-b-0">
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
                    active ? "bg-line-soft" : "hover:bg-page"
                  }`}
                >
                  <MapPin className="size-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                    {s.label}
                  </span>
                  <span className="shrink-0 text-xs text-ink-3">{s.sub}</span>
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

  // === COMPACT — sidhuvudet. Vita fält på navy, 1px linje mellan dem. ===
  if (variant === "compact") {
    return (
      <div ref={wrapRef} className="relative w-full">
        <form
          onSubmit={onSubmit}
          role="search"
          aria-label="Sök hantverkare"
          className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-px bg-line md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]"
        >
          <label className="relative col-span-2 flex bg-white focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-signal md:col-span-1">
            <span className="sr-only">Vad behöver du hjälp med?</span>
            {qInput(
              "h-11 w-full appearance-none rounded-none bg-transparent px-3 text-[15px] text-ink focus:outline-none",
              "Yrke eller företag",
            )}
          </label>
          <label className="relative flex bg-white focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-signal">
            <span className="sr-only">Var?</span>
            {ortInput(
              "h-11 w-full appearance-none rounded-none bg-transparent px-3 text-[15px] text-ink focus:outline-none",
              "Kommun eller ort",
            )}
            {ortDropdown}
          </label>
          <button
            type="submit"
            disabled={pending}
            className="sg-btn sg-btn-sok h-11 px-5 text-[15px]"
          >
            {pending ? "Söker…" : "Sök"}
          </button>
        </form>
        {dropdown}
      </div>
    );
  }

  // === DUAL — startsidans hero: vit yta, två fält med versala etiketter ===
  return (
    <div className="w-full">
      <div ref={wrapRef} className="relative w-full">
        <form
          onSubmit={onSubmit}
          role="search"
          aria-label="Sök hantverkare"
          className="grid w-full grid-cols-1 bg-white md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
        >
          <div className="relative px-4 pb-2 pt-3 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-navy md:px-5 md:pt-4">
            <label htmlFor={qId} className="sg-label block text-ink-2">
              Vad behöver du hjälp med?
            </label>
            {qInput(
              "mt-1 h-10 w-full appearance-none rounded-none bg-transparent text-lg font-medium text-ink focus:outline-none",
              "Elektriker, målare, VVS …",
            )}
          </div>
          <div className="relative border-t border-line px-4 pb-2 pt-3 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-navy md:border-l md:border-t-0 md:px-5 md:pt-4">
            <label htmlFor={ortId} className="sg-label block text-ink-2">
              Var?
            </label>
            {ortInput(
              "mt-1 h-10 w-full appearance-none rounded-none bg-transparent text-lg font-medium text-ink focus:outline-none",
              "Kommun eller ort",
            )}
            {ortDropdown}
          </div>
          <div className="p-2 md:pl-0">
            <button
              type="submit"
              disabled={pending}
              className="sg-btn sg-btn-sok h-14 w-full px-9 text-lg md:h-full md:min-h-[4.5rem]"
            >
              {pending ? "Söker…" : "Sök"}
            </button>
          </div>
        </form>
        {dropdown}
      </div>

      {snabbval && (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Vanliga yrken">
          {HERO_SNABBVAL.map((s) => (
            <li key={s.kategori}>
              <a
                href={`/sok?kategori=${s.kategori}`}
                onClick={(e) => {
                  // Står en ort i fältet söks yrket där; annars hela landet.
                  if (!ort.trim()) return;
                  e.preventDefault();
                  goToKategori(s.kategori);
                }}
                className="inline-flex min-h-11 items-center border border-white/40 px-3.5 text-[15px] font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Heroens snabbval — ett urval och en ordning ur SNABBVAL. */
const HERO_SNABBVAL = ["el", "maleri", "vvs", "snickeri", "tak", "mark-anlaggning"]
  .map((k) => SNABBVAL.find((s) => s.kategori === k))
  .filter((s): s is (typeof SNABBVAL)[number] => Boolean(s));
