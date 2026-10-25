export interface ItunesApiResult {
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  collectionViewUrl?: string;
  trackViewUrl?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  genres?: string[];
  releaseDate?: string;
  trackCount?: number;
  trackNumber?: number;
  trackTimeMillis?: number;
  description?: string;
  longDescription?: string;
  feedUrl?: string;
  wrapperType?: string;
  kind?: string;
}

export type ItunesCandidate = {
  itunes_id: number;
  title: string;
  artist: string;
  year: number | null;
  cover_url: string | null;
};

export type ItunesTrack = { number: number; title: string; duration_ms: number | null };

export function hiResCover(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace("100x100bb", "600x600bb");
}

export function parseYear(dateStr?: string): number | null {
  if (!dateStr) return null;
  const y = parseInt(dateStr.slice(0, 4));
  return isNaN(y) ? null : y;
}

export function collectionIdOf(item: ItunesApiResult): number {
  return item.collectionId ?? item.trackId ?? 0;
}

/** Genres without the catch-all "Music" / "Podcast" */
export function itunesGenres(item: ItunesApiResult): string[] {
  const genres = item.genres ?? (item.primaryGenreName ? [item.primaryGenreName] : []);
  return genres.filter((g) => g !== "Music" && g !== "Podcast");
}

export function toItunesCandidate(item: ItunesApiResult): ItunesCandidate {
  return {
    itunes_id: collectionIdOf(item),
    title: item.collectionName ?? item.trackName ?? "",
    artist: item.artistName ?? "",
    year: parseYear(item.releaseDate),
    cover_url: hiResCover(item.artworkUrl100),
  };
}

/**
 * Searches albums (or podcasts) in the Polish store, then worldwide if nothing was found.
 * Returns null when the first request fails.
 */
export async function searchItunes(term: string, type: string): Promise<ItunesApiResult[] | null> {
  const entity = type === "podcast" ? "podcast" : "album";
  const media = type === "podcast" ? "podcast" : "music";
  const params = new URLSearchParams({ term, entity, media, limit: "8" });
  const res = await fetch(`https://itunes.apple.com/search?${params}&country=PL`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json() as { results?: ItunesApiResult[] };
  if (data.results?.length) return data.results;

  const res2 = await fetch(`https://itunes.apple.com/search?${params}`, { cache: "no-store" });
  if (!res2.ok) return [];
  const data2 = await res2.json() as { results?: ItunesApiResult[] };
  return data2.results ?? [];
}

/** Track list of an album, sorted by track number; null when unavailable */
export async function fetchTracks(collectionId: number): Promise<ItunesTrack[] | null> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&country=PL`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json() as { results: ItunesApiResult[] };
    const songs = data.results.filter((r) => r.wrapperType === "track" && r.trackName);
    if (!songs.length) return null;
    return songs
      .sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0))
      .map((s) => ({
        number: s.trackNumber ?? 0,
        title: s.trackName ?? "",
        duration_ms: s.trackTimeMillis ?? null,
      }));
  } catch {
    return null;
  }
}
