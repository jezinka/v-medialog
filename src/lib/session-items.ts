import type { SessionRow } from "@/lib/types";

export interface SessionCalendarItem {
  id: number;
  seasonId: number | null;
  mediaId: number;
  title: string;
  author: string | null;
  mediaType: string;
  startDate: string;
  endDate: string | null;
  volumeEpisode: string | null;
  discontinued: boolean | null;
  cinema: boolean | number;
  tagList?: { id: number; name: string }[];
  additionalSessions: null;
}

export function sessionToCalendarItem(session: SessionRow): SessionCalendarItem {
  return {
    id: session.id,
    seasonId: session.seasonId,
    mediaId: session.mediaId,
    title: session.mediaTitle,
    author: session.author,
    mediaType: session.mediaType,
    startDate: session.startDate,
    endDate: session.endDate,
    volumeEpisode: session.seasonNumber != null ? String(session.seasonNumber) : null,
    discontinued: session.discontinued ? true : null,
    cinema: session.cinema,
    tagList: session.tagList,
    additionalSessions: null,
  };
}
