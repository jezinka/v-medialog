import type Database from "better-sqlite3";

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
  const hasSeasons = db.prepare(`SELECT 1 FROM seasons WHERE media_id=?`).get(mediaId);
  return Number(db.prepare(
    `INSERT INTO seasons (media_id, season_number, want_to_watch) VALUES (?, ?, 1)`
  ).run(mediaId, hasSeasons ? null : 1).lastInsertRowid);
}
