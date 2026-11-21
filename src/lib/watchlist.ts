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
 * Groups items by streaming platform. An item on several platforms appears under each of them.
 * Platforms with the most items come first (ties by name); items on no platform go last.
 */
export function groupByPlatform<T>(items: T[], platformsOf: (item: T) => string[]): PlatformGroup<T>[] {
  const map = new Map<string, T[]>();
  const none: T[] = [];
  for (const item of items) {
    const platforms = platformsOf(item);
    if (platforms.length === 0) none.push(item);
    for (const platform of platforms) {
      if (!map.has(platform)) map.set(platform, []);
      map.get(platform)!.push(item);
    }
  }
  const groups: PlatformGroup<T>[] = [...map]
    .sort(([a, x], [b, y]) => y.length - x.length || a.localeCompare(b, "pl"))
    .map(([platform, items]) => ({ platform, items }));
  return none.length ? [...groups, { platform: null, items: none }] : groups;
}
