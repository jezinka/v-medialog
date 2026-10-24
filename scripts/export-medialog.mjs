import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const rangeMode = process.env.EXPORT_RANGE ?? "month";
if (rangeMode !== "month" && rangeMode !== "year") {
  throw new Error("EXPORT_RANGE musi mieć wartość month albo year");
}
const output = process.argv[2] ?? (rangeMode === "year" ? "/tmp/medialog-year.json" : "/tmp/medialog.json");
const coversOutput = join(dirname(output), "medialog-covers");
const now = new Date();
const dateValue = process.env.CALENDAR_DATE
  ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
  throw new Error("CALENDAR_DATE musi mieć format RRRR-MM-DD");
}

const [year, month] = dateValue.split("-").map(Number);
const rangeStart = rangeMode === "year"
  ? `${year}-01-01`
  : `${year}-${String(month).padStart(2, "0")}-01`;
const rangeEnd = rangeMode === "year"
  ? `${year}-12-31`
  : `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
const dbPath = process.env.DATABASE_URL ?? "medialog.db";

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const hasWantToWatch = db.prepare("PRAGMA table_info(seasons)").all()
  .some((column) => column.name === "want_to_watch");
const sessions = db.prepare(`
  SELECT sn.id AS season_id, sn.season_number, se.start_date,
    COALESCE(se.end_date, se.start_date) AS end_date, m.title, m.media_type,
    COALESCE(sn.cover_url, m.cover_url) AS cover_url
  FROM sessions se
  JOIN seasons sn ON sn.id = se.season_id
  JOIN media m ON m.id = sn.media_id
  WHERE se.start_date <= ?
    AND COALESCE(se.end_date, se.start_date) >= ?
    AND julianday(COALESCE(se.end_date, se.start_date)) - julianday(se.start_date) < 364
    AND m.media_type IN ('book', 'comic', 'movie', 'series', 'anime', 'cartoon')
    ${hasWantToWatch ? "AND COALESCE(sn.want_to_watch, 0) = 0" : ""}
  ORDER BY se.start_date, se.id
`).all(rangeEnd, rangeStart);
db.close();

function isReading(mediaType) {
  return mediaType === "book" || mediaType === "comic";
}

function isSeasonal(mediaType) {
  return mediaType === "series" || mediaType === "anime" || mediaType === "cartoon";
}

function publicCoverUrl(coverUrl) {
  if (!coverUrl) return null;
  if (coverUrl.startsWith("https://")) return coverUrl;

  if (coverUrl.startsWith("/api/covers/") || coverUrl.startsWith("/covers/")) {
    const filename = basename(coverUrl);
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) return null;

    const source = join(dirname(dbPath), "covers", filename);
    if (!existsSync(source)) return null;

    copyFileSync(source, join(coversOutput, filename));
    return `data/medialog-covers/${filename}`;
  }

  return null;
}

mkdirSync(coversOutput, { recursive: true });
// One item per title/type/season: the same season can exist as several season rows.
// A numbered season/volume is matched by number; an unnumbered series season can't be, so it stays separate.
const itemsBySeason = new Map();
for (const session of sessions) {
  const coverUrl = publicCoverUrl(session.cover_url);
  const season = session.season_number ?? (isSeasonal(session.media_type) ? `row:${session.season_id}` : "");
  const key = `${session.media_type}|${session.title}|${season}`;

  if (!itemsBySeason.has(key)) {
    itemsBySeason.set(key, {
      id: `medialog:season:${session.season_id}`,
      title: session.title,
      kind: isReading(session.media_type) ? "reading" : "watching",
      mediaType: session.media_type,
      ...(isSeasonal(session.media_type) && session.season_number != null
        ? { seasonNumber: session.season_number }
        : {}),
      ...(coverUrl ? { coverUrl } : {}),
      periods: [],
    });
  }

  const item = itemsBySeason.get(key);
  if (!item.coverUrl && coverUrl) item.coverUrl = coverUrl;
  const startDate = session.start_date > rangeStart ? session.start_date : rangeStart;
  const endDate = session.end_date < rangeEnd ? session.end_date : rangeEnd;
  if (!item.periods.some((period) => period.startDate === startDate && period.endDate === endDate)) {
    item.periods.push({ startDate, endDate });
  }
}

const data = {
  schemaVersion: 1,
  source: "medialog",
  ...(rangeMode === "year" ? { year } : { month: rangeStart.slice(0, 7) }),
  items: [...itemsBySeason.values()],
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Wyeksportowano ${data.items.length} pozycji do ${output}`);
