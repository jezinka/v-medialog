import type { TmdbCandidate } from "@/lib/tmdb";

export type ImportType = "media" | "wishlist";

export interface MediaPreviewRow {
  title: string;
  original_title: string;
  author: string;
  media_type: string;
  start_date: string;
  end_date: string;
  volume_episode: string;
  tags: string;
  notes: string;
  discontinued: string;
  cover_url: string;
  cinema: string;
  additional_sessions: string;
}

export function isYearPlaceholder(item: ValidItem): boolean {
  const d = item.data as MediaPreviewRow;
  if (!d.start_date || !d.end_date) return false;
  return /^\d{4}-01-01$/.test(d.start_date) && /^\d{4}-12-31$/.test(d.end_date) && d.start_date.slice(0, 4) === d.end_date.slice(0, 4);
}

export interface WishlistPreviewRow {
  title: string;
  author: string;
  media_type: string;
  priority: string;
  notes: string;
  cover_url: string;
}

export type PreviewRow = MediaPreviewRow | WishlistPreviewRow;

export interface ValidItem {
  row: number;
  data: PreviewRow;
}

export interface InvalidItem {
  row: number;
  error: string;
  raw: string;
}

export interface PreviewResponse {
  valid: ValidItem[];
  invalid: InvalidItem[];
  total: number;
}

export interface ImportResult {
  inserted: number;
  failed: number;
  message: string;
}

export type { TmdbCandidate };

export type TmdbFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "candidates"; candidates: TmdbCandidate[] }
  | { status: "done"; start_date: string; end_date: string; show_name: string; episode_count: number; episode_dates: string[] }
  | { status: "error"; message: string };

export const MEDIA_TYPE_LABELS: Record<string, string> = {
  book: "Książka",
  comic: "Komiks",
  movie: "Film",
  series: "Serial",
  anime: "Anime",
  cartoon: "Film animowany",
};
