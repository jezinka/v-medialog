/** Watch-list seasons of one media, for showing a series once with its seasons inside */
export interface MediaGroup<T> { media_id: number; seasons: T[] }

/** Groups seasons by media in first-seen order; seasons ordered by number, unnumbered last. */
export function groupSeasonsByMedia<T extends { media_id: number; season_number: number | null }>(entries: T[]): MediaGroup<T>[] {
  const map = new Map<number, T[]>();
  for (const entry of entries) {
    if (!map.has(entry.media_id)) map.set(entry.media_id, []);
    map.get(entry.media_id)!.push(entry);
  }
  return [...map].map(([media_id, seasons]) => ({
    media_id,
    seasons: [...seasons].sort((a, b) => (a.season_number ?? Infinity) - (b.season_number ?? Infinity)),
  }));
}

/** A platform heading with the series available on it; `platform: null` collects series on no platform */
export interface PlatformGroup<T> { platform: string | null; items: T[] }

/**
 * Groups items by streaming platform, each item once: under the platform that has the most items
 * overall (ties by name), so the big services collect what they carry. Groups follow that same
 * order; items on no platform go last.
 */
export function groupByPlatform<T>(items: T[], platformsOf: (item: T) => string[]): PlatformGroup<T>[] {
  const counts = new Map<string, number>();
  for (const item of items) for (const p of platformsOf(item)) counts.set(p, (counts.get(p) ?? 0) + 1);
  const ranked = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b, "pl"));
  const rank = new Map(ranked.map((p, i) => [p, i]));
  const groups: PlatformGroup<T>[] = ranked.map((platform) => ({ platform, items: [] }));
  const none: T[] = [];
  for (const item of items) {
    const platforms = platformsOf(item);
    if (platforms.length === 0) none.push(item);
    else groups[Math.min(...platforms.map((p) => rank.get(p)!))].items.push(item);
  }
  const used = groups.filter((g) => g.items.length > 0);
  return none.length ? [...used, { platform: null, items: none }] : used;
}
