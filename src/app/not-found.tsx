import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

/**
 * 404 för hela sajten. Rotlayouten har inget eget huvud (det väljs i
 * route-grupperna), så sidan bär det kompakta huvudet själv.
 */
export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main className="w-full flex-1">
        <div className="sg-wrap py-16">
          <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-ink">Sidan finns inte</h1>
          <p className="mt-3 max-w-prose text-[17px]">
            Adressen kan vara fel, eller så har sidan flyttat. Sök efter företaget eller yrket i fältet
            överst, eller börja från en kommun.
          </p>
          <p className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="sg-btn sg-btn-navy">Till startsidan</Link>
            <Link href="/kommuner" className="sg-btn sg-btn-outline">Alla kommuner</Link>
          </p>
        </div>
      </main>
    </>
  );
}
