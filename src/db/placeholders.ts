import type Database from "better-sqlite3";

/** Year-long placeholder session: "watched/read sometime in YYYY" (YYYY-01-01 → YYYY-12-31). */
const isPlaceholder = (t: string) =>
  `(substr(${t}.start_date, 6) = '01-01' AND COALESCE(${t}.end_date, '') = substr(${t}.start_date, 1, 4) || '-12-31')`; // COALESCE: never NULL, so NOT works

/** Placeholders made redundant by a real session of the same season in the same year. */
const REDUNDANT = `
  FROM sessions p
  WHERE ${isPlaceholder("p")}
    AND EXISTS (
      SELECT 1 FROM sessions r
      WHERE r.season_id = p.season_id AND NOT ${isPlaceholder("r")}
        AND substr(r.start_date, 1, 4) = substr(p.start_date, 1, 4)
    )`;

export type RedundantPlaceholder = { session_id: number; media_id: number; title: string; year: string };

/** Preview of what removeRedundantPlaceholders would delete. */
export function redundantPlaceholders(db: Database.Database): RedundantPlaceholder[] {
  return db.prepare(`
    SELECT p.id AS session_id, m.id AS media_id, m.title, substr(p.start_date, 1, 4) AS year
    ${REDUNDANT.replace("FROM sessions p", "FROM sessions p JOIN seasons s ON s.id = p.season_id JOIN media m ON m.id = s.media_id")}
    ORDER BY m.title, year
  `).all() as RedundantPlaceholder[];
}

/**
 * Deletes redundant placeholders — of one season (after adding sessions to it) or everywhere.
 * Placeholders of years without a real session stay: they may be an earlier, separate watch.
 */
export function removeRedundantPlaceholders(db: Database.Database, seasonId?: number): number {
  return db.prepare(
    `DELETE FROM sessions WHERE id IN (SELECT p.id ${REDUNDANT}${seasonId != null ? " AND p.season_id = ?" : ""})`
  ).run(...(seasonId != null ? [seasonId] : [])).changes;
}
