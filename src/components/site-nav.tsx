"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Home, Search, MapPin, Layers, Briefcase } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { Ordmarke } from "@/components/ordmarke";
import { kommunBySlug } from "@/lib/kommuner";
import { yrkesnamn } from "@/lib/yrkesnamn";

/**
 * Sidhuvudet — navy på alla sidor.
 *
 * Startsidan: märket och navigeringen, och heron under fortsätter i samma
 * navy. Övriga sidor: kompakt huvud med sökformuläret, ifyllt med den sökning
 * sidan visar — på /sok ur adressens parametrar, på kommun- och yrkessidorna
 * ur sökvägen. Där finns ingen egen stor sökruta längre; den här är den.
 */
export function SiteNav() {
  const pathname = usePathname();

  if (pathname === "/") {
    return (
      <header className="sg-on-navy bg-navy text-white">
        <div className="sg-wrap flex h-16 items-center gap-4 sm:h-[72px]">
          <Link href="/" aria-label="Hantverkardelen, till startsidan" className="shrink-0">
            <Ordmarke stor />
          </Link>
          <nav aria-label="Huvudmeny" className="ml-auto flex items-center gap-1 text-[15px] font-semibold">
            <NavLink href="/branscher" label="Yrken" />
            <NavLink href="/kommuner" label="Kommuner" />
            <NavLink href="/#sa-funkar-det" label="Så funkar det" />
            <Link
              href="/kontakt"
              className="ml-2 inline-flex min-h-10 items-center bg-white px-3.5 font-bold text-navy transition-colors hover:bg-[var(--sg-line-soft)]"
            >
              För företag
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="sg-on-navy z-40 border-b border-white/10 bg-navy text-white md:sticky md:top-0">
      <div className="sg-wrap flex flex-col gap-3 py-3 md:h-[72px] md:flex-row md:items-center md:gap-6 md:py-0">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="Hantverkardelen, till startsidan" className="shrink-0">
            <Ordmarke />
          </Link>
          <Link
            href="/kontakt"
            className="inline-flex min-h-10 items-center border border-white/40 px-3 text-sm font-bold text-white transition-colors hover:border-white md:hidden"
          >
            För företag
          </Link>
        </div>
        <div className="min-w-0 flex-1 md:max-w-[44rem]">
          <Suspense fallback={<SearchBar variant="compact" {...franSokvag(pathname)} />}>
            <HuvudetsSok pathname={pathname} />
          </Suspense>
        </div>
        <nav
          aria-label="Huvudmeny"
          className="ml-auto hidden shrink-0 items-center gap-1 text-[15px] font-semibold lg:flex"
        >
          <NavLink href="/branscher" label="Yrken" current={pathname === "/branscher"} />
          <NavLink href="/kommuner" label="Kommuner" current={pathname.startsWith("/kommun")} />
          <Link
            href="/kontakt"
            aria-current={pathname === "/kontakt" ? "page" : undefined}
            className="ml-2 inline-flex min-h-10 items-center bg-white px-3.5 font-bold text-navy transition-colors hover:bg-[var(--sg-line-soft)]"
          >
            För företag
          </Link>
        </nav>
      </div>
    </header>
  );
}

/**
 * Sökrutan med sidans parametrar. useSearchParams() kräver en Suspense-gräns;
 * reservläget är samma ruta ifylld ur sökvägen, så att huvudet har samma höjd
 * före och efter och ingenting knuffas.
 *
 * Nyckeln byts vid varje navigering: huvudet ligger i layouten och lever kvar
 * mellan sidor, och utan ny nyckel stod förra sökningen kvar i fälten.
 */
function HuvudetsSok({ pathname }: { pathname: string }) {
  const sp = useSearchParams();
  const qs = sp.toString();
  const pasok = pathname.startsWith("/sok");
  const params = Object.fromEntries(sp.entries());
  return (
    <SearchBar
      key={`${pathname}?${qs}`}
      variant="compact"
      preserveFilters={pasok}
      {...(pasok ? { params } : franSokvag(pathname))}
    />
  );
}

/** /kommun/kungalv → ort; /kommun/kungalv/elektriker-43210 → ort och yrke. */
function franSokvag(pathname: string): { initialOrt?: string; initialValue?: string } {
  const m = pathname.match(/^\/kommun\/([^/]+)(?:\/[^/]*?-(\d+))?\/?$/);
  if (!m) return {};
  const kommun = kommunBySlug(m[1]);
  const ng1 = m[2] ? Number(m[2]) : null;
  return {
    initialOrt: kommun?.name,
    initialValue: ng1 ? yrkesnamn(ng1) : undefined,
  };
}

function NavLink({
  href,
  label,
  current = false,
}: {
  href: string;
  label: string;
  current?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`hidden min-h-10 items-center px-3 transition-colors hover:text-white md:inline-flex ${
        current ? "text-white underline decoration-signal decoration-2 underline-offset-[6px]" : "text-[var(--sg-on-navy-muted)]"
      }`}
    >
      {label}
    </Link>
  );
}

/**
 * Mobilens bottenmeny — fixerad nederst på små skärmar. Platt: vit yta,
 * 1px linje, den aktiva sidan markeras med en orange linje överst.
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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[max(env(safe-area-inset-bottom),0.25rem)] md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around text-xs">
        {items.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 border-t-2 transition-colors ${
                  active
                    ? "border-signal font-bold text-navy"
                    : "border-transparent text-ink-3 hover:text-ink"
                }`}
              >
                <Icon aria-hidden className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
