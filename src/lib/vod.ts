import { sqlite } from "@/db";
import { searchJustWatch, toJwObjectType, type JwOffer } from "@/lib/justwatch";

const LEAVING_SOON_DAYS = 7;

/** JustWatch lists Amazon add-on channels separately, e.g. "Apple TV Amazon Channel" next to "Apple TV". */
export function serviceName(providerName: string): string {
  return providerName.replace(/ Amazon Channels?$/, "");
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

/**
 * Fetches JustWatch offers for a media item and stores its subscription/free offers.
 * Notifies once per service (not per package or Amazon channel) when it appears or is about to leave.
 */
export async function refreshVodOffers(media: {
  id: number; title: string; year?: number | null; tmdbId?: number | null; mediaType?: string;
}): Promise<void> {
  const objectType = media.mediaType ? toJwObjectType(media.mediaType) : undefined;
  const jw = await searchJustWatch(media.title, { year: media.year, tmdbId: media.tmdbId, objectType });
  const offers = jw?.offers.filter((o) => o.monetizationType === "FLATRATE" || o.monetizationType === "FREE") ?? [];

  const existing = sqlite.prepare(
    `SELECT provider_slug, monetization_type, provider_name FROM vod_offers WHERE item_type='media' AND item_id=?`
  ).all(media.id) as { provider_slug: string; monetization_type: string; provider_name: string }[];
  const existingServices = new Set(existing.map((r) => serviceName(r.provider_name)));
  const incomingKeys = new Set(offers.map((o) => `${o.providerSlug}__${o.monetizationType}`));

  const upsert = sqlite.prepare(`
    INSERT INTO vod_offers
      (item_type, item_id, justwatch_id, provider_name, provider_logo, provider_slug,
       monetization_type, quality, url, available_from, available_to, last_checked_at)
    VALUES ('media',?,?,?,?,?,?,?,?,?,?,datetime('now'))
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
  const notify = (event: "added" | "leaving", service: string, o: JwOffer) => sqlite.prepare(`
    INSERT INTO vod_notifications (item_type, item_id, item_title, event_type, provider_name, provider_logo, url)
    VALUES ('media',?,?,?,?,?,?)
  `).run(media.id, media.title, event, service, o.providerLogo, o.url);
  const leavingNotifiedToday = (service: string) => sqlite.prepare(`
    SELECT 1 FROM vod_notifications
    WHERE item_type='media' AND item_id=? AND event_type='leaving' AND provider_name=?
      AND created_at >= datetime('now','-1 day')
  `).get(media.id, service);

  sqlite.transaction(() => {
    const notified = new Set<string>();
    for (const o of offers) {
      upsert.run(
        media.id, jw?.jwId ?? null, o.providerName, o.providerLogo, o.providerSlug,
        o.monetizationType, o.quality, o.url, o.availableFrom, o.availableTo
      );
      const service = serviceName(o.providerName);
      if (!existingServices.has(service) && !notified.has(`added:${service}`)) {
        notify("added", service, o);
        notified.add(`added:${service}`);
      }
      if (o.availableTo && daysUntil(o.availableTo) <= LEAVING_SOON_DAYS
          && !notified.has(`leaving:${service}`) && !leavingNotifiedToday(service)) {
        notify("leaving", service, o);
        notified.add(`leaving:${service}`);
      }
    }
    for (const r of existing) {
      if (!incomingKeys.has(`${r.provider_slug}__${r.monetization_type}`)) {
        sqlite.prepare(
          `DELETE FROM vod_offers WHERE item_type='media' AND item_id=? AND provider_slug=? AND monetization_type=?`
        ).run(media.id, r.provider_slug, r.monetization_type);
      }
    }
    sqlite.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, datetime('now'))`)
      .run(`vod_last_check:media:${media.id}`);
  })();
}
