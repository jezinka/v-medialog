export interface SessionRow {
  id: number;
  seasonId: number;
  startDate: string;
  endDate: string | null;
  cinema: boolean | number;
  seasonNumber: number | null;
  seasonTitle: string | null;
  seasonCoverUrl: string | null;
  mediaId: number;
  mediaTitle: string;
  mediaOriginalTitle: string | null;
  mediaType: string;
  mediaCoverUrl: string | null;
  author: string | null;
  notes: string | null;
  tags: string | null;
  discontinued: boolean | number;
  universeId: number | null;
  universeName: string | null;
  tagList?: { id: number; name: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSession(raw: any): SessionRow {
  return {
    id: raw.id,
    seasonId: raw.season_id,
    startDate: raw.start_date,
    endDate: raw.end_date ?? null,
    cinema: raw.cinema,
    seasonNumber: raw.season_number ?? null,
    seasonTitle: raw.season_title ?? null,
    seasonCoverUrl: raw.season_cover_url ?? null,
    mediaId: raw.media_id,
    mediaTitle: raw.media_title,
    mediaOriginalTitle: raw.media_original_title ?? null,
    mediaType: raw.media_type,
    mediaCoverUrl: raw.media_cover_url ?? null,
    author: raw.author ?? null,
    notes: raw.notes ?? null,
    tags: raw.tags ?? null,
    discontinued: raw.discontinued,
    universeId: raw.universe_id ?? null,
    universeName: raw.universe_name ?? null,
    tagList: raw.tagList,
  };
}
