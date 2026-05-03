import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), "medialog.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

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
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT,
    cinema INTEGER DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    media_type TEXT NOT NULL,
    notes TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    cover_url TEXT,
    added_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reading_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reading_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT,
    media_type TEXT NOT NULL,
    cover_url TEXT,
    media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
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

// Fix reading_list_items table if it incorrectly references "media_old" instead of "media"
try {
  const row = sqlite.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='reading_list_items'`).get() as { sql: string } | undefined;
  if (row?.sql?.includes('"media_old"')) {
    sqlite.exec(`PRAGMA foreign_keys = OFF`);
    sqlite.exec(`
      CREATE TABLE reading_list_items_fixed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id INTEGER NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        author TEXT,
        media_type TEXT NOT NULL,
        cover_url TEXT,
        media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO reading_list_items_fixed SELECT * FROM reading_list_items;
      DROP TABLE reading_list_items;
      ALTER TABLE reading_list_items_fixed RENAME TO reading_list_items;
    `);
    sqlite.exec(`PRAGMA foreign_keys = ON`);
    console.log("[db] Migrated reading_list_items table: fixed FK reference from media_old to media");
  }
} catch (e) { console.error("[db] reading_list_items FK migration error:", e); }

// Add season columns to reading_list_items if missing
try {
  const cols = (sqlite.prepare(`PRAGMA table_info(reading_list_items)`).all() as Array<{ name: string }>).map((c) => c.name);
  if (!cols.includes("season_number")) {
    sqlite.exec(`ALTER TABLE reading_list_items ADD COLUMN season_number INTEGER`);
    console.log("[db] Added season_number to reading_list_items");
  }
  if (!cols.includes("season_start_date")) {
    sqlite.exec(`ALTER TABLE reading_list_items ADD COLUMN season_start_date TEXT`);
    console.log("[db] Added season_start_date to reading_list_items");
  }
  if (!cols.includes("auto_added")) {
    sqlite.exec(`ALTER TABLE reading_list_items ADD COLUMN auto_added INTEGER DEFAULT 0`);
    console.log("[db] Added auto_added to reading_list_items");
  }
  if (!cols.includes("notes")) {
    sqlite.exec(`ALTER TABLE reading_list_items ADD COLUMN notes TEXT`);
    console.log("[db] Added notes to reading_list_items");
  }
} catch (e) { console.error("[db] reading_list_items season columns migration error:", e); }

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

export const db = drizzle(sqlite, { schema });
export { sqlite };
