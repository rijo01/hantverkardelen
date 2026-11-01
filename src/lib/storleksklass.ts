import { STORLEKSKLASS_PACKAD } from "./storleksklass-snapshot";
import { REGISTER_AR } from "./dataprovenans";

/**
 * Antal anställda — som SCB:s storleksklass, alltid ett intervall.
 *
 * Registrets `aeant` är antalet arbetsställen bolaget har, inte antalet
 * anställda (se scripts/hamta-storleksklass.mjs för mätningen). Sajten visade
 * det som "1 anställd" på nästan varje företag. Det enda anställdatal registret
 * har är arbetsställets storleksklass, `anstkl`, med SCB:s kodlista
 * (`anstkltable` i klustret). Den visas här som det den är: ett intervall,
 * från omkring 2011.
 *
 * Källdatan rörs inte; klassen läses ur en ögonblicksbild.
 */

/** SCB:s kodlista för storleksklass, ordagrant ur `anstkltable`. Kod 0 = uppgift saknas. */
const KLASSER: Readonly<Record<number, { min: number; max: number | null }>> = {
  1: { min: 0, max: 0 },
  2: { min: 1, max: 4 },
  3: { min: 5, max: 9 },
  4: { min: 10, max: 19 },
  5: { min: 20, max: 49 },
  6: { min: 50, max: 99 },
  7: { min: 100, max: 199 },
  8: { min: 200, max: 499 },
  9: { min: 500, max: 999 },
  10: { min: 1000, max: 1499 },
  11: { min: 1500, max: 1999 },
  12: { min: 2000, max: 2999 },
  13: { min: 3000, max: 3999 },
  14: { min: 4000, max: 4999 },
  15: { min: 5000, max: 9999 },
  16: { min: 10000, max: null },
};

let karta: Map<number, number> | null = null;

function packaUpp(): Map<number, number> {
  const m = new Map<number, number>();
  for (const [kod, packad] of Object.entries(STORLEKSKLASS_PACKAD)) {
    let cfarnr = 0;
    for (const d of packad.split(",")) {
      cfarnr += parseInt(d, 36);
      m.set(cfarnr, Number(kod));
    }
  }
  return m;
}

/** Arbetsställets storleksklass, eller null om registret saknar uppgift. */
export function storleksklassFor(cfarnr: number): number | null {
  karta ??= packaUpp();
  return karta.get(cfarnr) ?? null;
}

export type Anstallda = {
  /** "1–4 anställda", "0 anställda", "10 000+ anställda". */
  label: string;
  min: number;
  max: number | null;
};

const fmt = (n: number) => n.toLocaleString("sv-SE");

export function anstallda(klass: number | null | undefined): Anstallda | null {
  if (klass == null) return null;
  const k = KLASSER[klass];
  if (!k) return null;
  const spann =
    k.max == null ? `${fmt(k.min)}+` : k.min === k.max ? fmt(k.min) : `${fmt(k.min)}–${fmt(k.max)}`;
  return { label: `${spann} anställda`, min: k.min, max: k.max };
}

/** Meningen som används i beskrivning och FAQ. */
export function anstalldaMening(namn: string, a: Anstallda): string {
  return `Enligt registret från omkring ${REGISTER_AR} hade ${namn} ${a.label} på arbetsstället.`;
}

/** schema.org numberOfEmployees som ett intervall, aldrig ett exakt tal. */
export function anstalldaSchema(a: Anstallda) {
  return {
    "@type": "QuantitativeValue",
    minValue: a.min,
    ...(a.max != null ? { maxValue: a.max } : {}),
  };
}
