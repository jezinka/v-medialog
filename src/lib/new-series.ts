/** Countries whose new series the schedule lists */
export const NEW_SERIES_COUNTRIES = ["PL", "US", "GB"];

/**
 * TMDB networks whose originals stream in Poland. TMDB only knows a show's Polish platforms after it
 * airs, so for upcoming premieres the producing network is the best predictor.
 * ponytail: hand-picked list; add an id here when a platform starts or stops in Poland.
 */
export const NEW_SERIES_NETWORKS: Record<number, string> = {
  213: "Netflix",
  1024: "Prime Video",
  2552: "Apple TV+",
  2739: "Disney+",
  453: "Hulu (Disney+)",
  88: "FX (Disney+)",
  49: "HBO",
  8102: "HBO",
  3186: "HBO Max",
  8304: "HBO Max",
  6783: "Max",
  4330: "Paramount+ (SkyShowtime)",
  3353: "Peacock (SkyShowtime)",
  5944: "SkyShowtime",
  174: "AMC",
  318: "Starz",
  4: "BBC One",
  332: "BBC Two",
  26: "Channel 4",
  483: "TVP1",
  5892: "TVP VOD",
  504: "TVN",
  5033: "Player",
  951: "Canal+",
};

/** Reality (10764), talk (10767) and news (10763) are not series to wait for */
export const NEW_SERIES_EXCLUDED_GENRES = [10764, 10767, 10763];

export interface NewSeriesItem {
  tmdb_id: number;
  title: string;
  original_title: string;
  overview: string;
  first_air_date: string;
  origin_country: string[];
  poster_url: string | null;
  /** id of the media in the library with this TMDB id */
  media_id: number | null;
}

type TmdbDiscoverResult = {
  id: number;
  name?: string;
  original_name?: string;
  overview?: string;
  first_air_date?: string;
  origin_country?: string[];
  poster_path?: string | null;
};

/** Discover results → schedule items: dated ones only, each show once, linked to the library by TMDB id. */
export function toNewSeriesItems(results: TmdbDiscoverResult[], libraryIds: Map<number, number>): NewSeriesItem[] {
  const seen = new Set<number>();
  const items: NewSeriesItem[] = [];
  for (const r of results) {
    if (!r.first_air_date || seen.has(r.id)) continue;
    seen.add(r.id);
    items.push({
      tmdb_id: r.id,
      title: r.name || r.original_name || "",
      original_title: r.original_name ?? "",
      overview: r.overview ?? "",
      first_air_date: r.first_air_date,
      origin_country: r.origin_country ?? [],
      poster_url: r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : null,
      media_id: libraryIds.get(r.id) ?? null,
    });
  }
  return items;
}
