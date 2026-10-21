"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Search, MapPin, Layers, Briefcase, Hammer } from "lucide-react";
import { SearchBar } from "@/components/search-bar";

/**
 * Sidhuvudet — en rad: logo, sök (desktop), nav och väg in för hantverkare.
 *
 * Den mörkblå topbaren ovanför är borttagen: den upprepade taglinen och tog
 * 36px före första sökträffen. Sökrutan i huvudet visas bara från lg och
 * aldrig på startsidan eller /sok, som har en egen stor sökruta — förut låg
 * två sökrutor ovanpå varandra där, och på mobil lade sig huvudets ruta över
 * logotypen och brödsmulorna. Mobilen har Sök i bottenmenyn.
 */
export function SiteNav() {
  const pathname = usePathname();
  const egenSokruta = pathname === "/" || pathname.startsWith("/sok");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white transition-shadow duration-200 ${
        scrolled
          ? "border-[var(--rule)] shadow-[0_2px_8px_-4px_rgba(17,24,38,0.08)]"
          : "border-[var(--rule-soft)]"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 lg:gap-6">
        <Link
          href="/"
          aria-label="Hantverkardelen.se, till startsidan"
          className="flex shrink-0 items-center gap-2.5 text-[var(--text-strong)]"
        >
          <span
            aria-hidden
            className="inline-flex size-9 items-center justify-center rounded-lg bg-[var(--brand)] text-white"
          >
            <Hammer className="size-[18px]" strokeWidth={2.2} />
          </span>
          <span className="text-[17px] font-bold tracking-tight">
            Hantverkardelen<span className="text-[var(--accent-text)]">.se</span>
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 lg:block">
          {!egenSokruta ? (
            <SearchBar variant="compact" />
          ) : null}
        </div>
        <div className="flex-1 lg:hidden" />

        <nav aria-label="Huvudmeny" className="hidden shrink-0 items-center gap-0.5 text-sm md:flex">
          <NavLink href="/sok" label="Sök" current={pathname.startsWith("/sok")} />
          <NavLink
            href="/kommuner"
            label="Kommuner"
            current={pathname.startsWith("/kommun")}
          />
          <NavLink
            href="/branscher"
            label="Yrken"
            current={pathname === "/branscher"}
          />
        </nav>

        {/* Hantverkarnas väg in. Blå kontur: orange hör till sökningen. */}
        <Link
          href="/kontakt"
          className="hidden h-10 shrink-0 items-center rounded-lg border border-[var(--brand)]/35 px-3.5 text-sm font-semibold text-[var(--brand-ink)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--tint-1)] sm:inline-flex"
        >
          För hantverkare
        </Link>
      </div>
    </header>
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
      className={`inline-flex h-10 items-center rounded-md px-3 font-medium transition-colors ${
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
      label: "Yrken",
      icon: Layers,
      match: (p: string) => p.startsWith("/bransch"),
    },
    {
      href: "/kontakt",
      label: "För företag",
      icon: Briefcase,
      match: (p: string) => p.startsWith("/kontakt"),
    },
  ];

  return (
    <nav
      aria-label="Huvudnavigering"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--rule)] bg-white/92 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden"
      style={{ boxShadow: "0 -8px 24px -16px rgba(17,24,38,0.18)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 text-xs">
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
