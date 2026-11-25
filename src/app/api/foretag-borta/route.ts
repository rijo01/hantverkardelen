import { NextResponse } from "next/server";
import { getBranschName } from "@/lib/branscher";
import { STEG2 } from "@/lib/flaggor";
import { isHantverkBransch } from "@/lib/hantverk-branscher";
import { kommunByCode } from "@/lib/kommuner";
import { branschPageSlug, getSteg2Utfall } from "@/lib/queries";
import { yrkesnamn } from "@/lib/yrkesnamn";

/**
 * GET /api/foretag-borta?cfarnr=123 — länken till yrket i kommunen för
 * företagssidans 404 (steg två). not-found.tsx får inte sidans parametrar,
 * så den läser cfarnr ur adressen och frågar här.
 *
 * Svarar bara med en länk som redan finns på sajten (kommun × yrke), aldrig
 * med något om själva företaget. Tomt svar när yrket inte går att härleda.
 */
export async function GET(req: Request) {
  const cfarnr = Number(new URL(req.url).searchParams.get("cfarnr"));
  const tomt = NextResponse.json({}, { headers: { "cache-control": "public, s-maxage=3600" } });
  if (!STEG2 || !Number.isSafeInteger(cfarnr) || cfarnr <= 0) return tomt;
  const u = await getSteg2Utfall(cfarnr);
  if (!u || u.utfall !== "404" || !u.kommun_register || !isHantverkBransch(u.ng1_register)) return tomt;
  const kommun = kommunByCode(u.kommun_register);
  const ng1 = u.ng1_register!;
  const namn = await getBranschName(ng1);
  if (!kommun || !namn) return tomt;
  return NextResponse.json(
    { href: `/kommun/${kommun.slug}/${branschPageSlug(namn, ng1)}`, text: `${yrkesnamn(ng1, namn)} i ${kommun.name}` },
    { headers: { "cache-control": "public, s-maxage=3600" } },
  );
}
