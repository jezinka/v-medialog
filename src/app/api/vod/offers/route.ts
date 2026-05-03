import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const itemType = searchParams.get("itemType") as "media" | "wishlist" | null;
  const itemId = searchParams.get("itemId");

  if (!itemType || !itemId) {
    return NextResponse.json({ error: "Wymagane: itemType, itemId" }, { status: 400 });
  }

  const offers = sqlite.prepare(`
    SELECT * FROM vod_offers
    WHERE item_type=? AND item_id=?
    ORDER BY provider_name, monetization_type
  `).all(itemType, parseInt(itemId));

  // lastCheckedAt: from offers if any, otherwise from the settings sentinel
  const offerMeta = sqlite.prepare(`
    SELECT MAX(last_checked_at) as last_checked_at FROM vod_offers
    WHERE item_type=? AND item_id=?
  `).get(itemType, parseInt(itemId)) as { last_checked_at: string | null };

  const settingsMeta = sqlite.prepare(`
    SELECT value FROM settings WHERE key=?
  `).get(`vod_last_check:${itemType}:${parseInt(itemId)}`) as { value: string } | undefined;

  const lastCheckedAt = offerMeta?.last_checked_at ?? settingsMeta?.value ?? null;

  return NextResponse.json({ offers, lastCheckedAt });
}
