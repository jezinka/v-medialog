import { test } from "node:test";
import assert from "node:assert/strict";
import type { SessionRow } from "./types.ts";
import { sessionToCalendarItem } from "./session-items.ts";

const row = (mediaType: string, seasonNumber: number | null) => ({
  id: 1, seasonId: 1, startDate: "2026-07-19", endDate: null, cinema: 0, withChild: 0,
  seasonNumber, seasonTitle: null, seasonCoverUrl: null, mediaId: 1, mediaTitle: "T",
  mediaOriginalTitle: null, mediaType, mediaCoverUrl: null, author: null, notes: null,
  tags: null, discontinued: 0, universeId: null, universeName: null,
}) satisfies SessionRow;

test("calendar item shows the season number only for numbered types", () => {
  assert.equal(sessionToCalendarItem(row("series", 2)).volumeEpisode, "2");
  assert.equal(sessionToCalendarItem(row("comic", 1)).volumeEpisode, null);
  assert.equal(sessionToCalendarItem(row("book", 1)).volumeEpisode, null);
  assert.equal(sessionToCalendarItem(row("movie", 2)).volumeEpisode, null);
  assert.equal(sessionToCalendarItem(row("cartoon", 1)).volumeEpisode, null);
  assert.equal(sessionToCalendarItem(row("anime", 3)).volumeEpisode, "3");
  assert.equal(sessionToCalendarItem(row("series", null)).volumeEpisode, null);
});
