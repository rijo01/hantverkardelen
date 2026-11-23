import { STORLEKSKLASS_PACKAD } from "./storleksklass-snapshot";
import { skapaStorleksuppslag, anstallda as klustretsAnstallda, type Anstallda } from "./kluster/anstallda";

/** Arbetsställets storleksklass (SCB anstkl), eller null om registret saknar uppgift. */
export const storleksklassFor = skapaStorleksuppslag(STORLEKSKLASS_PACKAD);

/**
 * Antal anställda som det visas på hantverkardelen — klustrets intervall, utom
 * "0 anställda". Den klassen säger i ett tretton år gammalt register mest att
 * ingen var anställd på arbetsstället då (ofta en enmansfirma), och läst som
 * dagens uppgift ser den ut som att företaget inte finns. Raden utelämnas på
 * kort, profilsida, FAQ och i strukturerade data.
 */
export function anstallda(klass: number | null | undefined): Anstallda | null {
  const a = klustretsAnstallda(klass);
  return a && a.max === 0 ? null : a;
}

export { anstalldaMening, anstalldaSchema, type Anstallda } from "./kluster/anstallda";
