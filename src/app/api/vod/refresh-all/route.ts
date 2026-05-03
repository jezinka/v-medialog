import { NextResponse } from "next/server";
import { sqlite } from "@/db";
import { searchJustWatch, toJwObjectType, VOD_MEDIA_TYPES, type JwOffer } from "@/lib/justwatch";

const LEAVING_SOON_DAYS = 7;
const STALE_HOURS = 23; // skip items checked less than this many hours ago

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type MediaRow = { id: number; title: string; release_year: number | null; tmdb_id: number | null; media_type: string };
type WishlistRow = { id: number; title: string; media_type: string };

export async function POST() {
  try {
    // Collect items to refresh
    const mediaItems = sqlite.prepare(`
      SELECT id, title, release_year, tmdb_id, media_type FROM media
      WHERE media_type IN (${VOD_MEDIA_TYPES.map(() => "?").join(",")})
        AND (
          NOT EXISTS (SELECT 1 FROM vod_offers WHERE item_type='media' AND item_id=media.id)
          OR EXISTS (
            SELECT 1 FROM vod_offers
            WHERE item_type='media' AND item_id=media.id
              AND last_checked_at < datetime('now', '-${STALE_HOURS} hours')
          )
        )
    `).all(...VOD_MEDIA_TYPES) as MediaRow[];

    const wishlistItems = sqlite.prepare(`
      SELECT id, title, media_type FROM wishlist
      WHERE media_type IN (${VOD_MEDIA_TYPES.map(() => "?").join(",")})
        AND (
          NOT EXISTS (SELECT 1 FROM vod_offers WHERE item_type='wishlist' AND item_id=wishlist.id)
          OR EXISTS (
            SELECT 1 FROM vod_offers
            WHERE item_type='wishlist' AND item_id=wishlist.id
              AND last_checked_at < datetime('now', '-${STALE_HOURS} hours')
          )
        )
    `).all(...VOD_MEDIA_TYPES) as WishlistRow[];

    let refreshed = 0;
    let errors = 0;

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

    async function processItem(
      itemType: "media" | "wishlist",
      itemId: number,
      title: string,
      opts: { year?: number | null; tmdbId?: number | null; mediaType?: string }
    ) {
      const objectType = opts.mediaType ? toJwObjectType(opts.mediaType) : undefined;
      const jwResult = await searchJustWatch(title, {
        year: opts.year,
        tmdbId: opts.tmdbId,
        objectType,
      });

      const existing = sqlite.prepare(`
        SELECT provider_slug, monetization_type FROM vod_offers
        WHERE item_type=? AND item_id=?
      `).all(itemType, itemId) as { provider_slug: string; monetization_type: string }[];
      const existingKeys = new Set(existing.map((r) => `${r.provider_slug}__${r.monetization_type}`));

      if (!jwResult || jwResult.offers.length === 0) {
        sqlite.prepare(`DELETE FROM vod_offers WHERE item_type=? AND item_id=?`).run(itemType, itemId);
        sqlite.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, datetime('now'))`).run(`vod_last_check:${itemType}:${itemId}`);
        return;
      }

      const incomingKeys = new Set(jwResult.offers.map((o: JwOffer) => `${o.providerSlug}__${o.monetizationType}`));

      const txn = sqlite.transaction((offers: JwOffer[]) => {
        for (const o of offers) {
          const key = `${o.providerSlug}__${o.monetizationType}`;
          upsert.run(
            itemType, itemId, jwResult.jwId,
            o.providerName, o.providerLogo, o.providerSlug,
            o.monetizationType, o.quality, o.url,
            o.availableFrom, o.availableTo
          );
          if (!existingKeys.has(key)) {
            insertNotif.run(itemType, itemId, title, "added", o.providerName, o.providerLogo, o.url);
          }
          if (o.availableTo && daysUntil(o.availableTo) <= LEAVING_SOON_DAYS) {
            const notifToday = sqlite.prepare(`
              SELECT id FROM vod_notifications
              WHERE item_type=? AND item_id=? AND event_type='leaving' AND provider_name=?
                AND created_at >= datetime('now','-1 day')
            `).get(itemType, itemId, o.providerName);
            if (!notifToday) {
              insertNotif.run(itemType, itemId, title, "leaving", o.providerName, o.providerLogo, o.url);
            }
          }
        }
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
      sqlite.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, datetime('now'))`).run(`vod_last_check:${itemType}:${itemId}`);
    }

    // Process all items with 1s throttle between requests
    const allItems: (() => Promise<void>)[] = [
      ...mediaItems.map((m) => () => processItem("media", m.id, m.title, {
        year: m.release_year,
        tmdbId: m.tmdb_id,
        mediaType: m.media_type,
      })),
      ...wishlistItems.map((w) => () => processItem("wishlist", w.id, w.title, {
        mediaType: w.media_type,
      })),
    ];

    for (const task of allItems) {
      try {
        await task();
        refreshed++;
      } catch {
        errors++;
      }
      if (allItems.indexOf(task) < allItems.length - 1) await sleep(1000);
    }

    // Record last refresh time
    sqlite.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES ('last_vod_refresh', datetime('now'))
    `).run();

    return NextResponse.json({ refreshed, errors, total: allItems.length });
  } catch (err) {
    console.error("[vod/refresh-all]", err);
    return NextResponse.json({ error: "Błąd odświeżania VOD" }, { status: 500 });
  }
}
