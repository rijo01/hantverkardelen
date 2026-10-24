"use client";

import { useEffect, useState } from "react";
import { KONTAKT_NOTIS } from "@/lib/dataprovenans";

/**
 * Fast ringrad på mobil, ovanför bottenmenyn.
 *
 * Visas först när kontaktrutan (`ankareId`) har scrollats UPP ur bild. Så
 * länge rutan syns står numret redan på skärmen, och en fast rad hade bara
 * täckt innehållet under den. Utan JavaScript visas raden inte alls —
 * kontaktrutan högst upp bär samma nummer.
 *
 * En enda handling. Ingen försäljning här: raden tillhör besökarens ärende.
 */
export function MobilRingrad({
  telefon,
  namn,
  ankareId,
}: {
  telefon: string;
  namn: string;
  ankareId: string;
}) {
  const [synlig, setSynlig] = useState(false);

  useEffect(() => {
    const ankare = document.getElementById(ankareId);
    if (!ankare) return;
    const observer = new IntersectionObserver(([entry]) => {
      setSynlig(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(ankare);
    return () => observer.disconnect();
  }, [ankareId]);

  return (
    <div
      aria-hidden={!synlig}
      inert={!synlig}
      className={`fixed inset-x-0 bottom-[calc(3.5rem+max(env(safe-area-inset-bottom),0.25rem))] z-30 border-t border-line bg-white px-4 py-2 transition-[transform,opacity,visibility] duration-200 ease-out motion-reduce:transition-none md:hidden ${
        synlig ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-4 opacity-0"
      }`}
    >
      <a
        href={`tel:${telefon.replace(/[^\d+]/g, "")}`}
        aria-label={`Ring ${namn}, ${telefon}. ${KONTAKT_NOTIS}.`}
        className="sg-btn sg-btn-navy h-12 w-full tabular-nums"
      >
        Ring {telefon}
      </a>
    </div>
  );
}
