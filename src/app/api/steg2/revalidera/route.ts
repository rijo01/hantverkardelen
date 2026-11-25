import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { ANTAL_TAGG } from "@/lib/antal";
import { STEG2 } from "@/lib/flaggor";
import { SIGNATURE_HEADER, sentAtArFarsk, verifyOverlaySignature } from "@/lib/overlay-contract";

export const dynamic = "force-dynamic";

/**
 * POST /api/steg2/revalidera — anropas av scripts/steg2-upphorda.mjs när
 * hantverk_steg2 är skriven och vyn ombyggd. Varje företagssida, lista,
 * kommunsida och sitemap kan ha ändrats, så hela sajten markeras inaktuell
 * och byggs om vid nästa besök.
 *
 * Signerad med samma hemlighet som overlay-flödet (OVERLAY_PUBLISH_SECRET).
 */
export async function POST(req: Request) {
  if (!STEG2) return NextResponse.json({ ok: false, error: "steg två är inte på" }, { status: 404 });
  const raw = await req.text();
  const hemlighet = process.env.OVERLAY_PUBLISH_SECRET;
  if (!hemlighet || !(await verifyOverlaySignature(raw, hemlighet, req.headers.get(SIGNATURE_HEADER)))) {
    return NextResponse.json({ ok: false, error: "ogiltig signatur" }, { status: 401 });
  }
  let paket: { action?: string; sent_at?: string };
  try {
    paket = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bodyn är inte JSON" }, { status: 400 });
  }
  if (paket.action !== "steg2_revalidera" || !sentAtArFarsk(paket.sent_at ?? "")) {
    return NextResponse.json({ ok: false, error: "fel action eller för gammal" }, { status: 400 });
  }
  // Antalen (lib/antal.ts) ligger i datacachen, inte i sidorna: rensa dem först.
  revalidateTag(ANTAL_TAGG, { expire: 0 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, revalidated: [ANTAL_TAGG, "/ (layout)"] }, { headers: { "cache-control": "no-store" } });
}
