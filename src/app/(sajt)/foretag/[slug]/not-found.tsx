import { STEG2 } from "@/lib/flaggor";
import { FtgBortaLank } from "./FtgBortaLank";
import Link from "next/link";

/**
 * 404 för företagssidan. Med steg två (lib/flaggor.ts) är det oftast ett
 * företag ur det köpta registret som inte längre finns i SCB:s register.
 * Texten säger det, och besökaren får ett sökfält och, när det går, en länk
 * till yrket i kommunen. Utan steg två: samma besked som sajtens övriga 404.
 */
export default function ForetagSaknas() {
  return (
    <div className="sg-wrap py-16">
      <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-ink">
        {STEG2 ? "Företaget finns inte i katalogen" : "Sidan finns inte"}
      </h1>
      <p className="mt-3 max-w-prose text-[17px]">
        {STEG2
          ? "Företaget finns inte i katalogen. Det kan ha upphört eller bytt namn."
          : "Adressen kan vara fel, eller så har sidan flyttat. Sök efter företaget eller yrket nedan, eller börja från en kommun."}
      </p>
      <form action="/sok" method="get" role="search" className="mt-6 flex max-w-xl gap-2">
        <label htmlFor="foretag-saknas-sok" className="sr-only">Sök företag eller yrke</label>
        <input
          id="foretag-saknas-sok"
          name="q"
          type="search"
          placeholder="Företag, yrke eller ort"
          className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-[16px] text-ink"
        />
        <button type="submit" className="sg-btn sg-btn-navy">Sök</button>
      </form>
      <p className="mt-6 flex flex-wrap gap-3">
        {STEG2 ? <FtgBortaLank /> : null}
        <Link href="/kommuner" className="sg-btn sg-btn-outline">Alla kommuner</Link>
      </p>
    </div>
  );
}
