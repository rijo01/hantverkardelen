import { StartHuvud } from "@/components/site-nav";

/**
 * Startsidans layout. Huvudet väljs här, av routern, och inte med
 * usePathname() i rotlayouten — se StartHuvud i components/site-nav.tsx.
 */
export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StartHuvud />
      <main className="w-full flex-1">{children}</main>
    </>
  );
}
