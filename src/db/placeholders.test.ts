import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { redundantPlaceholders, removeRedundantPlaceholders } from "./placeholders.ts";

test("removeRedundantPlaceholders drops only same-year placeholders", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE media (id INTEGER PRIMARY KEY, title TEXT);
    CREATE TABLE seasons (id INTEGER PRIMARY KEY, media_id INTEGER);
    CREATE TABLE sessions (id INTEGER PRIMARY KEY, season_id INTEGER, start_date TEXT, end_date TEXT);
    INSERT INTO media VALUES (1, 'Kwiaty dla Algernona');
    INSERT INTO seasons VALUES (1, 1), (2, 1);
    INSERT INTO sessions VALUES
      (1, 1, '2025-01-01', '2025-12-31'),  -- placeholder, real read in 2025 → redundant
      (2, 1, '2025-06-01', '2025-06-11'),
      (3, 1, '2023-01-01', '2023-12-31'),  -- placeholder of another year → stays
      (4, 2, '2024-01-01', '2024-12-31'),  -- placeholder; real Jan 1 session below → redundant
      (5, 2, '2024-01-01', NULL);          -- real one-day session on Jan 1, not a placeholder
  `);
  assert.deepEqual(redundantPlaceholders(db).map((p) => p.session_id), [4, 1]); // by title, then year
  assert.equal(removeRedundantPlaceholders(db, 2), 1);
  assert.equal(removeRedundantPlaceholders(db), 1);
  assert.deepEqual(db.prepare(`SELECT id FROM sessions ORDER BY id`).all().map((r) => (r as { id: number }).id), [2, 3, 5]);
});
