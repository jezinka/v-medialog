import Database from "better-sqlite3";
import path from "path";
import { addUpcomingSeason, markWantToWatch } from "./want-to-watch";
import { upcomingCheckDue } from "../lib/schedule";

const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), "medialog.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS universes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    universe_id INTEGER REFERENCES universes(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    original_title TEXT,
    author TEXT,
    media_type TEXT NOT NULL,
    cover_url TEXT,
    tmdb_id INTEGER,
    ol_key TEXT,
    description TEXT,
    genres TEXT,
    vote_average REAL,
    runtime INTEGER,
    release_year INTEGER,
    volume_episode TEXT,
    external_synced_at TEXT,
    tags TEXT,
    notes TEXT,
    discontinued INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    season_number INTEGER,
    title TEXT,
    cover_url TEXT,
    want_to_watch INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT,
    cinema INTEGER DEFAULT 0,
    with_child INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media_tags (
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (media_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    photo_url TEXT,
    tmdb_id INTEGER,
    ol_author_key TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media_persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    character_name TEXT,
    display_order INTEGER DEFAULT 0
  );
`);

try { sqlite.exec("CREATE UNIQUE INDEX idx_persons_tmdb_id ON persons (tmdb_id) WHERE tmdb_id IS NOT NULL"); } catch { /* already exists */ }
try { sqlite.exec("CREATE UNIQUE INDEX idx_persons_name ON persons (name)"); } catch { /* already exists */ }

// Migrations for existing databases
try { sqlite.exec("ALTER TABLE media ADD COLUMN volume_episode TEXT"); } catch { /* already exists */ }
try { sqlite.exec("ALTER TABLE media ADD COLUMN series_status TEXT"); } catch { /* already exists */ }
try { sqlite.exec("ALTER TABLE media ADD COLUMN tmdb_seasons_count INTEGER"); } catch { /* already exists */ }
try { sqlite.exec("ALTER TABLE media ADD COLUMN track_list TEXT"); } catch { /* already exists */ }
try { sqlite.exec("ALTER TABLE seasons ADD COLUMN want_to_watch INTEGER DEFAULT 0"); } catch { /* already exists */ }
try { sqlite.exec("ALTER TABLE sessions ADD COLUMN with_child INTEGER DEFAULT 0"); } catch { /* already exists */ }

// Fix seasons table if it incorrectly references "media_old" instead of "media"
try {
  const row = sqlite.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='seasons'`).get() as { sql: string } | undefined;
  if (row?.sql?.includes('"media_old"')) {
    sqlite.exec(`PRAGMA foreign_keys = OFF`);
    sqlite.exec(`
      CREATE TABLE seasons_fixed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
        season_number INTEGER,
        title TEXT,
        cover_url TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO seasons_fixed SELECT * FROM seasons;
      DROP TABLE seasons;
      ALTER TABLE seasons_fixed RENAME TO seasons;
    `);
    sqlite.exec(`PRAGMA foreign_keys = ON`);
    console.log("[db] Migrated seasons table: fixed FK reference from media_old to media");
  }
} catch (e) { console.error("[db] seasons FK migration error:", e); }

// Fix media_tags table if it incorrectly references "media_old" instead of "media"
try {
  const row = sqlite.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='media_tags'`).get() as { sql: string } | undefined;
  if (row?.sql?.includes('"media_old"')) {
    sqlite.exec(`PRAGMA foreign_keys = OFF`);
    sqlite.exec(`
      CREATE TABLE media_tags_fixed (
        media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT (datetime('now')),
        PRIMARY KEY (media_id, tag_id)
      );
      INSERT OR IGNORE INTO media_tags_fixed SELECT mt.* FROM media_tags mt
        WHERE EXISTS (SELECT 1 FROM media m WHERE m.id = mt.media_id);
      DROP TABLE media_tags;
      ALTER TABLE media_tags_fixed RENAME TO media_tags;
    `);
    sqlite.exec(`PRAGMA foreign_keys = ON`);
    console.log("[db] Migrated media_tags table: fixed FK reference from media_old to media");
  }
} catch (e) { console.error("[db] media_tags FK migration error:", e); }

// ── VOD availability tables ──────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS vod_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL CHECK(item_type IN ('media','wishlist')),
    item_id INTEGER NOT NULL,
    justwatch_id TEXT,
    provider_name TEXT NOT NULL,
    provider_logo TEXT,
    provider_slug TEXT NOT NULL,
    monetization_type TEXT NOT NULL,
    quality TEXT,
    url TEXT,
    available_from TEXT,
    available_to TEXT,
    last_checked_at TEXT DEFAULT (datetime('now')),
    UNIQUE(item_type, item_id, provider_slug, monetization_type)
  );

  CREATE TABLE IF NOT EXISTS vod_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    item_title TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('added','leaving')),
    provider_name TEXT NOT NULL,
    provider_logo TEXT,
    url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    seen_at TEXT
  );
`);

// New series hidden from the "✨ Nowe seriale" tab, by TMDB id
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS ignored_new_series (
    tmdb_id INTEGER PRIMARY KEY,
    ignored_at TEXT DEFAULT (datetime('now'))
  );
`);

// Replace the legacy wishlist table with seasons.want_to_watch
const hasWishlistTable = () => Boolean(sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='wishlist'`).get());
if (hasWishlistTable()) {
  // immediate: take the write lock up front so a second starting process waits instead of migrating twice
  sqlite.transaction(() => {
    if (!hasWishlistTable()) return;
    const rows = sqlite.prepare(`SELECT title, author, media_type, notes, cover_url FROM wishlist`).all() as {
      title: string; author: string | null; media_type: string; notes: string | null; cover_url: string | null;
    }[];
    for (const row of rows) {
      // Title alone can't identify media: reuse only an unambiguous match, otherwise create new media
      const matches = sqlite.prepare(`SELECT id FROM media WHERE title=? AND media_type=?`).all(row.title, row.media_type) as { id: number }[];
      const mediaId = matches.length === 1
        ? matches[0].id
        : Number(sqlite.prepare(
          `INSERT INTO media (title, author, media_type, notes, cover_url, discontinued) VALUES (?, ?, ?, ?, ?, 0)`
        ).run(row.title, row.author, row.media_type, row.notes, row.cover_url).lastInsertRowid);
      if (matches.length === 1 && row.notes) {
        sqlite.prepare(`UPDATE media SET notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || char(10) || ? END WHERE id=?`)
          .run(row.notes, row.notes, mediaId);
      }
      markWantToWatch(sqlite, mediaId);
    }
    sqlite.exec(`
      DELETE FROM vod_offers WHERE item_type='wishlist';
      DELETE FROM vod_notifications WHERE item_type='wishlist';
      DROP TABLE wishlist;
    `);
    console.log(`[db] Migrated ${rows.length} wishlist rows to seasons.want_to_watch`);
  }).immediate();
}

// Remove the abandoned YouTube media type with its data and columns
const mediaCols = (sqlite.prepare(`PRAGMA table_info(media)`).all() as { name: string }[]).map((c) => c.name);
if (mediaCols.includes("youtube_id") || mediaCols.includes("source_url") || sqlite.prepare(`SELECT 1 FROM media WHERE media_type='yt'`).get()) {
  sqlite.transaction(() => {
    sqlite.exec(`
      -- Channels linked only to YouTube media go with them
      DELETE FROM persons
      WHERE id IN (SELECT mp.person_id FROM media_persons mp JOIN media m ON m.id = mp.media_id WHERE m.media_type = 'yt')
        AND id NOT IN (SELECT mp.person_id FROM media_persons mp JOIN media m ON m.id = mp.media_id WHERE m.media_type != 'yt');
      DELETE FROM vod_offers WHERE item_type = 'media' AND item_id IN (SELECT id FROM media WHERE media_type = 'yt');
      DELETE FROM vod_notifications WHERE item_type = 'media' AND item_id IN (SELECT id FROM media WHERE media_type = 'yt');
      DELETE FROM media WHERE media_type = 'yt';
      DROP TABLE IF EXISTS yt_history;
    `);
    const cols = (sqlite.prepare(`PRAGMA table_info(media)`).all() as { name: string }[]).map((c) => c.name);
    if (cols.includes("youtube_id")) sqlite.exec(`ALTER TABLE media DROP COLUMN youtube_id`);
    if (cols.includes("source_url")) sqlite.exec(`ALTER TABLE media DROP COLUMN source_url`);
    console.log("[db] Removed YouTube media type");
  }).immediate();
}

// Replace reading lists (only fed by the upcoming-seasons job, never shown in the UI) with seasons.want_to_watch
if (sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='reading_list_items'`).get()) {
  sqlite.transaction(() => {
    if (!sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='reading_list_items'`).get()) return;
    const items = sqlite.prepare(`SELECT * FROM reading_list_items`).all() as {
      title: string; author: string | null; media_type: string; cover_url: string | null;
      media_id: number | null; season_number?: number | null; season_start_date?: string | null;
    }[];
    for (const item of items) {
      if (item.media_id && item.season_number != null) {
        addUpcomingSeason(sqlite, {
          mediaId: item.media_id,
          seasonNumber: item.season_number,
          title: `Sezon ${item.season_number}`,
          coverUrl: item.cover_url,
          airDate: item.season_start_date ?? null,
        });
      } else {
        // Manually added items had no media yet
        const mediaId = item.media_id ?? Number(sqlite.prepare(
          `INSERT INTO media (title, author, media_type, cover_url, discontinued) VALUES (?, ?, ?, ?, 0)`
        ).run(item.title, item.author, item.media_type, item.cover_url).lastInsertRowid);
        markWantToWatch(sqlite, mediaId);
      }
    }
    sqlite.exec(`DROP TABLE reading_list_items; DROP TABLE IF EXISTS reading_lists;`);
    console.log(`[db] Migrated ${items.length} reading list items to seasons.want_to_watch`);
  }).immediate();
}

// ── Auto-refresh VOD data every 24h on server startup ───────────────────────
// Uses setTimeout to run asynchronously after the module is loaded.
const g = globalThis as Record<string, unknown>;
if (typeof g.__vodRefreshScheduled === "undefined") {
  g.__vodRefreshScheduled = true;

  setTimeout(async () => {
    try {
      const row = sqlite.prepare(`SELECT value FROM settings WHERE key='last_vod_refresh'`).get() as { value: string } | undefined;
      const lastRefresh = row?.value ? new Date(row.value) : null;
      const hoursSince = lastRefresh ? (Date.now() - lastRefresh.getTime()) / 3_600_000 : Infinity;

      if (hoursSince >= 24) {
        console.log("[vod] Auto-refresh starting (last:", lastRefresh?.toISOString() ?? "never", ")");
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
        await fetch(`${baseUrl}/api/vod/refresh-all`, { method: "POST" });
        console.log("[vod] Auto-refresh complete");
      } else {
        console.log(`[vod] Auto-refresh skipped (last refresh ${Math.round(hoursSince)}h ago)`);
      }
    } catch (e) {
      console.error("[vod] Auto-refresh error:", e);
    }
  }, 5000); // 5s delay to let the server fully start
}

// ── Upcoming seasons: checked in a new month or once a week, while the server runs ──
// Production only: a dev server shouldn't call TMDB and write to the local DB on its own
if (process.env.NODE_ENV === "production" && typeof g.__upcomingCheckScheduled === "undefined") {
  g.__upcomingCheckScheduled = true;
  let running = false;
  const checkUpcoming = async () => {
    if (running) return;
    running = true;
    try {
      const row = sqlite.prepare(`SELECT value FROM settings WHERE key='last_upcoming_check'`).get() as { value: string } | undefined;
      if (!upcomingCheckDue(row?.value ?? null, new Date())) return;
      console.log("[upcoming] Checking upcoming seasons (last:", row?.value ?? "never", ")");
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
      const res = await fetch(`${baseUrl}/api/jobs/check-upcoming-seasons`, { method: "POST", signal: AbortSignal.timeout(30 * 60_000) });
      console.log("[upcoming] Done:", res.status);
    } catch (e) {
      console.error("[upcoming] Check error:", e);
    } finally {
      running = false;
    }
  };
  setTimeout(checkUpcoming, 15_000); // after the VOD refresh has started
  setInterval(checkUpcoming, 6 * 3_600_000);
}

export { sqlite };
