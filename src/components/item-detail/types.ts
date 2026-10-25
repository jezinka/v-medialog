// Shapes of /api/media/[id] data shared by ItemDetailPage and its parts.

export interface MediaData {
  id: number;
  title: string;
  original_title: string | null;
  author: string | null;
  media_type: string;
  cover_url: string | null;
  universe_id: number | null;
  universe_name: string | null;
  notes: string | null;
  tags: string | null;
  discontinued: boolean | number;
  tmdb_id: number | null;
  ol_key: string | null;
  description: string | null;
  genres: string | null;
  vote_average: number | null;
  runtime: number | null;
  release_year: number | null;
  external_synced_at: string | null;
  series_status: string | null;
  season_count: number;
  first_session_date: string | null;
  last_session_date: string | null;
  tagList: { id: number; name: string }[];
}

export interface SessionApiRow {
  id: number;
  season_id: number;
  start_date: string;
  end_date: string | null;
  cinema: boolean | number;
  with_child: boolean | number | null;
  season_number: number | null;
  season_title: string | null;
  media_id: number;
  media_title: string;
  media_type: string;
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
  want_to_watch: boolean | number | null;
}

export type CachedPerson = {
  personId: number;
  name: string;
  role: string;
  characterName: string | null;
  photoUrl: string | null;
  displayOrder: number;
};

/** /api/media/[id]/external: details pulled from TMDB / iTunes / Open Library. */
export type CachedData = {
  tmdbId: number | null;
  olKey: string | null;
  externalSyncedAt: string | null;
  description: string | null;
  genres: string[];
  voteAverage: number | null;
  runtime: number | null;
  releaseYear: number | null;
  seriesStatus: string | null;
  tmdbSeasonsCount: number | null;
  trackList: Array<{ number: number; title: string; duration_ms: number | null }> | null;
  persons: CachedPerson[];
};
