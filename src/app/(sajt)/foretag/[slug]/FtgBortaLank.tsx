"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Länken till yrket i kommunen på företagssidans 404 (steg två).
 * not-found.tsx får inte sidans parametrar, så cfarnr läses ur adressen
 * (slugen slutar alltid på "-{cfarnr}") och länken hämtas från
 * /api/foretag-borta. Går yrket inte att härleda visas ingen länk.
 */
export function FtgBortaLank() {
  const path = usePathname();
  const [lank, setLank] = useState<{ href: string; text: string } | null>(null);
  useEffect(() => {
    const cfarnr = path?.match(/-(\d+)\/?$/)?.[1];
    if (!cfarnr) return;
    let aktuell = true;
    fetch(`/api/foretag-borta?cfarnr=${cfarnr}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { href?: string; text?: string }) => {
        if (aktuell && d.href && d.text) setLank({ href: d.href, text: d.text });
      })
      .catch(() => {});
    return () => {
      aktuell = false;
    };
  }, [path]);
  if (!lank) return null;
  return (
    <Link href={lank.href} className="sg-btn sg-btn-navy">
      {lank.text}
    </Link>
  );
}
