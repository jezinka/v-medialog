export interface MediaItem {
  id: number;
  title: string;
  original_title: string | null;
  author: string | null;
  media_type: string;
  cover_url: string | null;
  season_count: number;
  first_session_date: string | null;
  last_session_date: string | null;
  has_child_session?: boolean;
  has_cinema_session?: boolean;
  tmdb_id: string | null;
  series_status: string | null;
  tmdb_seasons_count: number | null;
}

export interface SeasonRow {
  id: number;
  media_id: number;
  season_number: number | null;
  title: string | null;
  cover_url: string | null;
  session_count: number;
  first_session_date: string | null;
  last_session_date: string | null;
  has_child_session?: boolean;
  has_cinema_session?: boolean;
}

export const TYPE_FILTERS = ["all", "series", "anime", "cartoon", "movie", "book", "comic", "play"] as const;
export type TypeFilter = (typeof TYPE_FILTERS)[number];
export type SortBy = "title" | "recently_added" | "last_session";
