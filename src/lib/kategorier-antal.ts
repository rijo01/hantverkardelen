import { hamtaAntal } from "./antal";
import { HANTVERK_KATEGORIER, type HantverkKategori } from "./hantverk-kategorier";

/**
 * Kategorierna med dagens tal: registret plus påfyllningen och steg två
 * (lib/antal.ts). Bara på servern; hantverk-kategorier.ts används också i
 * sökrutan (klient) och får därför inte läsa databasen.
 */
export async function hamtaKategorier(): Promise<ReadonlyArray<HantverkKategori>> {
  const a = await hamtaAntal();
  return HANTVERK_KATEGORIER.map((k) => ({ ...k, count: k.count + k.ng1.reduce((n, b) => n + a.nyaIBransch(b), 0) }));
}
