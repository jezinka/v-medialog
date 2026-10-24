import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { serviceName } from "@/lib/vod";

type Offer = { provider_name: string; monetization_type: string };

/**
 * One offer per service: JustWatch lists e.g. Apple TV as Sub, Free and "Apple TV Amazon Channel".
 * Prefers the service itself over its Amazon channel, then subscription over free.
 */
function onePerService<T extends Offer>(offers: T[]): T[] {
  const rank = (o: T) => (serviceName(o.provider_name) !== o.provider_name ? 2 : 0) + (o.monetization_type === "FLATRATE" ? 0 : 1);
  const best = new Map<string, { offer: T; rank: number }>();
  for (const o of offers) {
    const name = serviceName(o.provider_name);
    const prev = best.get(name);
    if (!prev || rank(o) < prev.rank) best.set(name, { offer: { ...o, provider_name: name }, rank: rank(o) });
  }
  return [...best.values()].map((b) => b.offer);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const itemType = searchParams.get("itemType") as "media" | null;
  const itemId = searchParams.get("itemId");

  if (!itemType || !itemId) {
    return NextResponse.json({ error: "Wymagane: itemType, itemId" }, { status: 400 });
  }

  const offers = sqlite.prepare(`
    SELECT * FROM vod_offers
    WHERE item_type=? AND item_id=? AND monetization_type IN ('FLATRATE', 'FREE')
    ORDER BY provider_name, monetization_type
  `).all(itemType, parseInt(itemId)) as { provider_name: string; monetization_type: string }[];

  // lastCheckedAt: from offers if any, otherwise from the settings sentinel
  const offerMeta = sqlite.prepare(`
    SELECT MAX(last_checked_at) as last_checked_at FROM vod_offers
    WHERE item_type=? AND item_id=?
  `).get(itemType, parseInt(itemId)) as { last_checked_at: string | null };

  const settingsMeta = sqlite.prepare(`
    SELECT value FROM settings WHERE key=?
  `).get(`vod_last_check:${itemType}:${parseInt(itemId)}`) as { value: string } | undefined;

  const lastCheckedAt = offerMeta?.last_checked_at ?? settingsMeta?.value ?? null;

  return NextResponse.json({ offers: onePerService(offers), lastCheckedAt });
}
