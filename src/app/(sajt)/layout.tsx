import { SiteNav } from "@/components/site-nav";

/** Alla sidor utom startsidan: det kompakta huvudet med sökformuläret. */
export default function SajtLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="w-full flex-1">{children}</main>
    </>
  );
}
