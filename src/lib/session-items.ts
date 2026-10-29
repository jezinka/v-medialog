import type { SessionRow } from "@/lib/types";
import { hasSeasonNumbers } from "./utils.ts";

interface SessionCalendarItem {
  id: number;
  seasonId: number | null;
  mediaId: number;
  title: string;
  author: string | null;
  mediaType: string;
  /** The season's own cover, else the title's */
  coverUrl: string | null;
  startDate: string;
  endDate: string | null;
  volumeEpisode: string | null;
  discontinued: boolean | null;
  cinema: boolean | number;
  withChild: boolean | number;
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
    coverUrl: session.seasonCoverUrl ?? session.mediaCoverUrl,
    startDate: session.startDate,
    endDate: session.endDate,
    // Books and movies keep a season row per read / watch, but its number isn't meant to be shown
    volumeEpisode: session.seasonNumber != null && hasSeasonNumbers(session.mediaType) ? String(session.seasonNumber) : null,
    discontinued: session.discontinued ? true : null,
    cinema: session.cinema,
    withChild: session.withChild,
    tagList: session.tagList,
    additionalSessions: null,
  };
}
