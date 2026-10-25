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
