import type Database from "better-sqlite3";
import { SCREEN_TYPES, hasSeasonNumbers } from "../lib/utils";
import { planSeasonNumbers } from "../lib/season-numbering";

type SeasonNumberRow = { id: number; season_number: number | null };

/** Same order as GET /api/seasons, so numbers match what the season grid showed. */
function orderedSeasons(db: Database.Database, mediaId: number): SeasonNumberRow[] {
  return db.prepare(`
    SELECT s.id, s.season_number FROM seasons s WHERE s.media_id = ?
    ORDER BY (SELECT MIN(se.start_date) FROM sessions se WHERE se.season_id = s.id) ASC NULLS LAST, s.season_number, s.id
  `).all(mediaId) as SeasonNumberRow[];
}

function mediaType(db: Database.Database, mediaId: number): string {
  const m = db.prepare(`SELECT media_type FROM media WHERE id=?`).get(mediaId) as { media_type: string } | undefined;
  return m?.media_type ?? "";
}

/**
 * Number for a new season of a media that already has seasons: numbers the existing
 * unnumbered ones first (as displayed), then returns the next free number.
 * Returns null for the first season of a media and for movies/books (re-watches stay unnumbered).
 */
export function nextSeasonNumber(db: Database.Database, mediaId: number): number | null {
  const type = mediaType(db, mediaId);
  if (!hasSeasonNumbers(type)) return null;
  const rows = orderedSeasons(db, mediaId);
  if (rows.length === 0) return null;
  const plan = planSeasonNumbers(rows, SCREEN_TYPES.includes(type));
  if (plan) {
    const update = db.prepare(`UPDATE seasons SET season_number=? WHERE id=?`);
    for (const p of plan) update.run(p.season_number, p.id);
  }
  const { max } = db.prepare(`SELECT MAX(season_number) AS max FROM seasons WHERE media_id=?`).get(mediaId) as { max: number | null };
  return (max ?? 0) + 1;
}
