"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Home, Search, MapPin, Layers, Phone, Hammer } from "lucide-react";
import { SearchBar } from "@/components/search-bar";

/**
 * Toppen av sajten består av två rader:
 *   1. Topbar (mörkblå, tunn) — kort tagline, scrollar bort med sidan
 *   2. Header (vit, sticky) — logo, sök, nav och anslut-knapp
 *
 * När användaren scrollar gömmer vi topbaren och låter header:n ligga kvar
 * högst upp. Söket bakas in i header:n förutom på startsidan, där
 * hero-sektionen redan har en stor sökbar.
 */
export function SiteNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* ===== Topbar — mörkblå, scrollar bort ===== */}
      <div className="bg-[var(--brand-2)] text-white">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between gap-4 px-4 text-[12px]">
          <span className="hidden truncate sm:inline">
            Söktjänst för hem & hantverk — bygg, el, VVS, måleri, snickare m.fl.
          </span>
          <span className="text-white/85 sm:hidden">Hem & hantverk i Sverige</span>
          <Link
            href="/kontakt"
            className="inline-flex items-center gap-1.5 font-medium text-white transition hover:text-white/90"
          >
            <Phone aria-hidden className="size-3.5" />
            Anslut företag
          </Link>
        </div>
      </div>

      {/* ===== Header — vit, sticky ===== */}
      <header
        className={`sticky top-0 z-40 border-b transition-colors duration-200 ${
          scrolled
            ? "border-[var(--rule)] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)]"
            : "border-[var(--rule-soft)] bg-white"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 lg:gap-6">
          {/* Logo */}
          <Link
            href="/"
            aria-label="Hantverkardelen.se, till startsidan"
            className="flex shrink-0 items-center gap-2.5 text-[var(--text-strong)]"
          >
            <span
              aria-hidden
              className="relative inline-flex size-10 items-center justify-center rounded-xl bg-[var(--brand)] text-white shadow-[0_4px_12px_-4px_rgba(10,77,140,0.45)]"
            >
              <Hammer className="size-5" strokeWidth={2.2} />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[17px] font-bold tracking-tight">
                Hantverkardelen<span className="text-[var(--accent-cta)]">.se</span>
              </span>
              <span className="hidden text-[11px] font-medium text-[var(--text-muted)] sm:inline">
                Söktjänst för hem & hantverk
              </span>
            </span>
          </Link>

          {/* Centrerat sök (visas inte på startsidan eftersom hero har det) */}
          <div className="flex-1">
            {!isHome ? (
              <div className="flex justify-center sm:justify-start lg:pl-6">
                <Suspense fallback={null}>
                  <SearchBar variant="compact" />
                </Suspense>
              </div>
            ) : null}
          </div>

          {/* Nav-länkar (desktop) */}
          <nav className="hidden shrink-0 items-center gap-0.5 text-[13px] lg:flex">
            <NavLink href="/sok" label="Sök hantverkare" current={pathname === "/sok"} />
            <NavLink
              href="/kommuner"
              label="Kommuner"
              current={pathname.startsWith("/kommun")}
            />
            <NavLink
              href="/branscher"
              label="Kategorier"
              current={pathname === "/branscher"}
            />
            <NavLink href="/kontakt" label="Kontakt" current={pathname === "/kontakt"} />
          </nav>

          {/* Höger: anslut-CTA.
              Språkväljaren och "Logga in" låg här men var attrapper — sajten
              har varken flerspråkighet eller inloggning. De är borttagna
              hellre än länkade till en sida som inte finns. */}
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <Link
              href="/kontakt"
              className="inline-flex h-9 items-center rounded-md bg-[var(--accent-cta)] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[var(--accent-cta-2)] active:scale-[0.99]"
            >
              Anslut företag
            </Link>
          </div>

          {/* Tablet — kompakta knappar utan språk */}
          <div className="hidden shrink-0 items-center gap-2 md:flex lg:hidden">
            <Link
              href="/kontakt"
              className="inline-flex h-9 items-center rounded-md bg-[var(--accent-cta)] px-3 text-[12px] font-semibold text-white transition hover:bg-[var(--accent-cta-2)]"
            >
              Anslut
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

function NavLink({
  href,
  label,
  current,
}: {
  href: string;
  label: string;
  current: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
        current
          ? "text-[var(--brand-ink)] bg-[var(--tint-2)]"
          : "text-[var(--text-body)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-strong)]"
      }`}
    >
      {label}
    </Link>
  );
}

/**
 * Mobil bottom-nav — fixerad nederst på små skärmar.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  const items = [
    { href: "/", label: "Hem", icon: Home, match: (p: string) => p === "/" },
    {
      href: "/sok",
      label: "Sök",
      icon: Search,
      match: (p: string) => p.startsWith("/sok"),
    },
    {
      href: "/kommuner",
      label: "Kommuner",
      icon: MapPin,
      match: (p: string) => p.startsWith("/kommun"),
    },
    {
      href: "/branscher",
      label: "Kategorier",
      icon: Layers,
      match: (p: string) => p.startsWith("/bransch"),
    },
    {
      href: "/kontakt",
      label: "Kontakt",
      icon: Phone,
      match: (p: string) => p.startsWith("/kontakt"),
    },
  ];

  return (
    <nav
      aria-label="Huvudnavigering"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--rule)] bg-white/92 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden"
      style={{ boxShadow: "0 -8px 24px -16px rgba(17,24,38,0.18)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 text-[11px]">
        {items.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                  active
                    ? "text-[var(--brand-ink)]"
                    : "text-[var(--text-dim)] hover:text-[var(--text-strong)]"
                }`}
              >
                <Icon
                  aria-hidden
                  className={`size-[18px] ${active ? "stroke-[2.4px]" : ""}`}
                />
                <span className={active ? "font-medium" : ""}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
