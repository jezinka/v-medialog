import type Database from "better-sqlite3";
import { SCREEN_TYPES } from "../lib/utils";
import { planSeasonNumbers } from "../lib/season-numbering";

type SeasonNumberRow = { id: number; season_number: number | null };

/** Same order as GET /api/seasons, so numbers match what the season grid showed. */
function orderedSeasons(db: Database.Database, mediaId: number): SeasonNumberRow[] {
  return db.prepare(`
    SELECT s.id, s.season_number FROM seasons s WHERE s.media_id = ?
    ORDER BY (SELECT MIN(se.start_date) FROM sessions se WHERE se.season_id = s.id) ASC NULLS LAST, s.season_number, s.id
  `).all(mediaId) as SeasonNumberRow[];
}

function hasSpecials(db: Database.Database, mediaId: number): boolean {
  const m = db.prepare(`SELECT media_type FROM media WHERE id=?`).get(mediaId) as { media_type: string } | undefined;
  return !!m && SCREEN_TYPES.includes(m.media_type);
}

export type SeasonNumberingEntry = {
  media_id: number; title: string; media_type: string;
  changes: { season_id: number; season_number: number }[] | null; // null = clash, fix by hand
};

/** Media with 2+ seasons where some are unnumbered, and the numbers they would get. */
export function seasonNumberingPlan(db: Database.Database): SeasonNumberingEntry[] {
  const media = db.prepare(`
    SELECT m.id, m.title, m.media_type FROM media m
    WHERE (SELECT COUNT(*) FROM seasons s WHERE s.media_id = m.id) >= 2
      AND EXISTS (SELECT 1 FROM seasons s WHERE s.media_id = m.id AND s.season_number IS NULL)
    ORDER BY m.title
  `).all() as { id: number; title: string; media_type: string }[];
  return media.map((m) => {
    const plan = planSeasonNumbers(orderedSeasons(db, m.id), SCREEN_TYPES.includes(m.media_type));
    return {
      media_id: m.id, title: m.title, media_type: m.media_type,
      changes: plan && plan.map((p) => ({ season_id: p.id, season_number: p.season_number })),
    };
  });
}

/** Writes the clash-free part of the plan in one transaction; returns the number of seasons numbered. */
export function applySeasonNumbering(db: Database.Database, plan: SeasonNumberingEntry[]): number {
  const update = db.prepare(`UPDATE seasons SET season_number=? WHERE id=? AND season_number IS NULL`);
  return db.transaction(() => plan.flatMap((e) => e.changes ?? [])
    .reduce((n, c) => n + update.run(c.season_number, c.season_id).changes, 0))();
}

/**
 * Number for a new season of a media that already has seasons: numbers the existing
 * unnumbered ones first (as displayed), then returns the next free number.
 * Returns null for the first season of a media (single movies/books stay unnumbered).
 */
export function nextSeasonNumber(db: Database.Database, mediaId: number): number | null {
  const rows = orderedSeasons(db, mediaId);
  if (rows.length === 0) return null;
  const plan = planSeasonNumbers(rows, hasSpecials(db, mediaId));
  if (plan) {
    const update = db.prepare(`UPDATE seasons SET season_number=? WHERE id=?`);
    for (const p of plan) update.run(p.season_number, p.id);
  }
  const { max } = db.prepare(`SELECT MAX(season_number) AS max FROM seasons WHERE media_id=?`).get(mediaId) as { max: number | null };
  return (max ?? 0) + 1;
}
