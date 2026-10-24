import { NextResponse } from "next/server";
import { sqlite } from "@/db";
import { VOD_MEDIA_TYPES } from "@/lib/justwatch";
import { refreshVodOffers } from "@/lib/vod";

const STALE_HOURS = 23; // skip items checked less than this many hours ago

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type MediaRow = { id: number; title: string; release_year: number | null; tmdb_id: number | null; media_type: string };

export async function POST() {
  try {
    // ponytail: batch VOD refresh is only for "Do obejrzenia" (seasons.want_to_watch=1)
    const mediaItems = sqlite.prepare(`
      SELECT id, title, release_year, tmdb_id, media_type FROM media
      WHERE media_type IN (${VOD_MEDIA_TYPES.map(() => "?").join(",")})
        AND EXISTS (
          SELECT 1 FROM seasons
          WHERE seasons.media_id = media.id AND seasons.want_to_watch = 1
        )
        AND (
          NOT EXISTS (SELECT 1 FROM vod_offers WHERE item_type='media' AND item_id=media.id)
          OR EXISTS (
            SELECT 1 FROM vod_offers
            WHERE item_type='media' AND item_id=media.id
              AND last_checked_at < datetime('now', '-${STALE_HOURS} hours')
          )
        )
    `).all(...VOD_MEDIA_TYPES) as MediaRow[];

    let refreshed = 0;
    let errors = 0;

    // Process all items with 1s throttle between requests
    const allItems: (() => Promise<void>)[] = mediaItems.map((m) => () => refreshVodOffers({
      id: m.id,
      title: m.title,
      year: m.release_year,
      tmdbId: m.tmdb_id,
      mediaType: m.media_type,
    }));

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
