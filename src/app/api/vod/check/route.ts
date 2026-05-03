import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { searchJustWatch, toJwObjectType, type JwOffer } from "@/lib/justwatch";

const LEAVING_SOON_DAYS = 7;

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      itemType: "media" | "wishlist";
      itemId: number;
      title: string;
      year?: number | null;
      tmdbId?: number | null;
      mediaType?: string;
    };
    const { itemType, itemId, title, year, tmdbId, mediaType } = body;

    if (!itemType || !itemId || !title) {
      return NextResponse.json({ error: "Wymagane: itemType, itemId, title" }, { status: 400 });
    }

    const objectType = mediaType ? toJwObjectType(mediaType) : undefined;
    const jwResult = await searchJustWatch(title, { year, tmdbId, objectType });

    const newNotifications: {
      eventType: string;
      providerName: string;
      providerLogo: string | null;
      url: string | null;
    }[] = [];

    if (!jwResult || jwResult.offers.length === 0) {
      // No offers found — remove stale records and record check timestamp
      sqlite.prepare(`DELETE FROM vod_offers WHERE item_type=? AND item_id=?`).run(itemType, itemId);
      sqlite.prepare(`
        INSERT OR REPLACE INTO settings (key, value) VALUES (?, datetime('now'))
      `).run(`vod_last_check:${itemType}:${itemId}`);

      return NextResponse.json({ offers: [], newNotifications: [], jwId: jwResult?.jwId ?? null });
    }

    // Load existing offers for diff
    const existing = sqlite.prepare(`
      SELECT * FROM vod_offers WHERE item_type=? AND item_id=?
    `).all(itemType, itemId) as {
      id: number; provider_slug: string; monetization_type: string; available_to: string | null;
    }[];

    const existingKeys = new Set(existing.map((r) => `${r.provider_slug}__${r.monetization_type}`));
    const incomingKeys = new Set(jwResult.offers.map((o) => `${o.providerSlug}__${o.monetizationType}`));

    const upsert = sqlite.prepare(`
      INSERT INTO vod_offers
        (item_type, item_id, justwatch_id, provider_name, provider_logo, provider_slug,
         monetization_type, quality, url, available_from, available_to, last_checked_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(item_type, item_id, provider_slug, monetization_type)
      DO UPDATE SET
        justwatch_id=excluded.justwatch_id,
        provider_name=excluded.provider_name,
        provider_logo=excluded.provider_logo,
        quality=excluded.quality,
        url=excluded.url,
        available_from=excluded.available_from,
        available_to=excluded.available_to,
        last_checked_at=datetime('now')
    `);

    const insertNotif = sqlite.prepare(`
      INSERT INTO vod_notifications
        (item_type, item_id, item_title, event_type, provider_name, provider_logo, url)
      VALUES (?,?,?,?,?,?,?)
    `);

    const txn = sqlite.transaction((offers: JwOffer[]) => {
      for (const o of offers) {
        const key = `${o.providerSlug}__${o.monetizationType}`;
        upsert.run(
          itemType, itemId, jwResult.jwId,
          o.providerName, o.providerLogo, o.providerSlug,
          o.monetizationType, o.quality, o.url,
          o.availableFrom, o.availableTo
        );

        // Notify: new platform appeared
        if (!existingKeys.has(key)) {
          insertNotif.run(itemType, itemId, title, "added", o.providerName, o.providerLogo, o.url);
          newNotifications.push({ eventType: "added", providerName: o.providerName, providerLogo: o.providerLogo, url: o.url });
        }

        // Notify: leaving soon (and haven't notified this yet today)
        if (o.availableTo && daysUntil(o.availableTo) <= LEAVING_SOON_DAYS) {
          const alreadyNotified = sqlite.prepare(`
            SELECT id FROM vod_notifications
            WHERE item_type=? AND item_id=? AND event_type='leaving'
              AND provider_slug IS NULL -- legacy
              AND provider_name=?
              AND date(created_at) = date('now')
          `).get(itemType, itemId, o.providerName);

          // simpler: just check if a leaving notification for this provider exists today
          const notifToday = sqlite.prepare(`
            SELECT id FROM vod_notifications
            WHERE item_type=? AND item_id=? AND event_type='leaving' AND provider_name=?
              AND created_at >= datetime('now','-1 day')
          `).get(itemType, itemId, o.providerName);

          if (!notifToday && !alreadyNotified) {
            insertNotif.run(itemType, itemId, title, "leaving", o.providerName, o.providerLogo, o.url);
            newNotifications.push({ eventType: "leaving", providerName: o.providerName, providerLogo: o.providerLogo, url: o.url });
          }
        }
      }

      // Remove offers that are no longer present
      for (const key of existingKeys) {
        if (!incomingKeys.has(key)) {
          const [slug, mtype] = key.split("__");
          sqlite.prepare(`
            DELETE FROM vod_offers
            WHERE item_type=? AND item_id=? AND provider_slug=? AND monetization_type=?
          `).run(itemType, itemId, slug, mtype);
        }
      }
    });

    txn(jwResult.offers);

    // Record check timestamp (also covers the "has offers" path)
    sqlite.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES (?, datetime('now'))
    `).run(`vod_last_check:${itemType}:${itemId}`);

    const updatedOffers = sqlite.prepare(`
      SELECT * FROM vod_offers WHERE item_type=? AND item_id=? ORDER BY provider_name, monetization_type
    `).all(itemType, itemId);

    return NextResponse.json({ offers: updatedOffers, newNotifications, jwId: jwResult.jwId });
  } catch (err) {
    console.error("[vod/check]", err);
    return NextResponse.json({ error: "Błąd sprawdzania VOD" }, { status: 500 });
  }
}
