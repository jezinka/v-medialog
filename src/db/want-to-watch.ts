import type Database from "better-sqlite3";
import { nextSeasonNumber } from "./season-numbering";

/**
 * Marks media as "want to watch": reuses an already flagged season, otherwise flags
 * its newest season without sessions, or creates a new season when every season has sessions.
 * Takes the db handle so db/index.ts migrations can use it without a circular import.
 */
export function markWantToWatch(db: Database.Database, mediaId: number): number {
  const flagged = db.prepare(
    `SELECT id FROM seasons WHERE media_id=? AND want_to_watch=1 ORDER BY id DESC LIMIT 1`
  ).get(mediaId) as { id: number } | undefined;
  if (flagged) return flagged.id;
  const empty = db.prepare(
    `SELECT id FROM seasons WHERE media_id=? AND NOT EXISTS (SELECT 1 FROM sessions WHERE season_id=seasons.id) ORDER BY id DESC LIMIT 1`
  ).get(mediaId) as { id: number } | undefined;
  if (empty) {
    db.prepare(`UPDATE seasons SET want_to_watch=1 WHERE id=?`).run(empty.id);
    return empty.id;
  }
  return Number(db.prepare(
    `INSERT INTO seasons (media_id, season_number, want_to_watch) VALUES (?, ?, 1)`
  ).run(mediaId, nextSeasonNumber(db, mediaId) ?? 1).lastInsertRowid);
}

/**
 * Puts an upcoming season on the want-to-watch list with a premiere marker session
 * (start = end = air date). A season that already has real sessions is left alone.
 * Returns false when nothing was added.
 */
export function addUpcomingSeason(
  db: Database.Database,
  season: { mediaId: number; seasonNumber: number; title: string | null; coverUrl: string | null; airDate: string | null }
): boolean {
  const existing = db.prepare(
    `SELECT id, want_to_watch, (SELECT COUNT(*) FROM sessions WHERE season_id=seasons.id) AS sessions
     FROM seasons WHERE media_id=? AND season_number=? ORDER BY id DESC LIMIT 1`
  ).get(season.mediaId, season.seasonNumber) as { id: number; want_to_watch: number; sessions: number } | undefined;
  if (existing && existing.want_to_watch === 0 && existing.sessions > 0) return false;
  // ponytail: many watched seasons have no season_number, so also treat any real session on/after
  // the premiere as "already started"; exact only once every season is numbered
  if (season.airDate && db.prepare(
    `SELECT 1 FROM sessions se JOIN seasons sn ON sn.id = se.season_id
     WHERE sn.media_id=? AND sn.want_to_watch=0 AND COALESCE(se.end_date, se.start_date) >= ? LIMIT 1`
  ).get(season.mediaId, season.airDate)) return false;
  // ponytail: an unnumbered season already on the list with a premiere marker within ~90 days is taken
  // to be this same season (e.g. Silos S3 added by hand without a number); exact only with numbered seasons
  if (season.airDate && db.prepare(
    `SELECT 1 FROM sessions se JOIN seasons sn ON sn.id = se.season_id
     WHERE sn.media_id=? AND sn.want_to_watch=1 AND sn.season_number IS NULL
       AND ABS(julianday(se.start_date) - julianday(?)) <= 90 LIMIT 1`
  ).get(season.mediaId, season.airDate)) return false;

  const seasonId = existing
    ? existing.id
    : Number(db.prepare(
      `INSERT INTO seasons (media_id, season_number, title, cover_url, want_to_watch) VALUES (?, ?, ?, ?, 1)`
    ).run(season.mediaId, season.seasonNumber, season.title, season.coverUrl).lastInsertRowid);
  db.prepare(`UPDATE seasons SET want_to_watch=1 WHERE id=?`).run(seasonId);
  if (season.airDate && !(existing && existing.sessions > 0)) {
    db.prepare(`INSERT INTO sessions (season_id, start_date, end_date) VALUES (?, ?, ?)`).run(seasonId, season.airDate, season.airDate);
  }
  return true;
}
