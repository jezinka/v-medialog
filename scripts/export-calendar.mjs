import Database from "better-sqlite3";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const output = process.argv[2] ?? "/tmp/medialog-calendar.html";
const dbPath = process.env.DATABASE_URL ?? "medialog.db";
const dateValue = process.env.CALENDAR_DATE ?? new Date().toISOString().slice(0, 10);

if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
  throw new Error("CALENDAR_DATE musi mieć format RRRR-MM-DD");
}

const [year, month] = dateValue.split("-").map(Number);
const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
const monthNames = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];
const dayLabels = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const seasonColumns = db.prepare("PRAGMA table_info(seasons)").all();
const hasWantToWatch = seasonColumns.some((column) => column.name === "want_to_watch");
const sessions = db.prepare(`
  SELECT se.id, se.start_date, COALESCE(se.end_date, se.start_date) AS end_date,
    m.title, m.media_type
  FROM sessions se
  JOIN seasons sn ON sn.id = se.season_id
  JOIN media m ON m.id = sn.media_id
  WHERE se.start_date <= ?
    AND COALESCE(se.end_date, se.start_date) >= ?
    AND julianday(COALESCE(se.end_date, se.start_date)) - julianday(se.start_date) < 364
    AND m.media_type IN ('book', 'comic', 'movie', 'series', 'anime', 'cartoon')
    ${hasWantToWatch ? "AND sn.want_to_watch = 0" : ""}
  ORDER BY se.start_date, se.id
`).all(monthEnd, monthStart);
db.close();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function isBook(mediaType) {
  return mediaType === "book" || mediaType === "comic";
}

function dayNumber(date) {
  return Number(date.slice(8, 10));
}

const sessionsByDay = new Map();
for (const session of sessions) {
  const start = session.start_date > monthStart ? session.start_date : monthStart;
  const end = session.end_date < monthEnd ? session.end_date : monthEnd;
  for (let day = dayNumber(start); day <= dayNumber(end); day++) {
    if (!sessionsByDay.has(day)) sessionsByDay.set(day, []);
    sessionsByDay.get(day).push(session);
  }
}

const firstDay = (new Date(year, month - 1, 1).getDay() + 6) % 7;
const daysInMonth = dayNumber(monthEnd);
const cells = [
  ...Array.from({ length: firstDay }, () => '<div class="day empty"></div>'),
  ...Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const entries = sessionsByDay.get(day) ?? [];
    const events = entries.map((entry) => {
      const label = `${isBook(entry.media_type) ? "Czytam" : "Oglądam"}: ${entry.title}`;
      return `<span class="event ${isBook(entry.media_type) ? "book" : "screen"}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></span>`;
    }).join("");
    return `<div class="day"><span class="number">${day}</span><span class="events">${events}</span></div>`;
  }),
];

const list = sessions.length === 0
  ? "<p class=\"none\">Brak zapisanych sesji.</p>"
  : `<ul>${sessions.map((session) => {
    const kind = isBook(session.media_type) ? "Czytam" : "Oglądam";
    return `<li><span class="${isBook(session.media_type) ? "book-text" : "screen-text"}">${kind}</span> ${escapeHtml(session.title)} <time>${escapeHtml(session.start_date)}–${escapeHtml(session.end_date)}</time></li>`;
  }).join("")}</ul>`;

const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MediaLog — ${monthNames[month - 1]} ${year}</title>
<style>
  :root { color-scheme: light; font-family: system-ui, sans-serif; color: #1f2937; }
  body { margin: 0; background: #fff; }
  main { box-sizing: border-box; max-width: 420px; padding: 12px; }
  h1 { margin: 0 0 8px; font-size: 18px; }
  .legend, .none, ul { margin: 8px 0 0; font-size: 12px; color: #4b5563; }
  .dot, .event { display: inline-block; border-radius: 999px; }
  .dot { width: 8px; height: 8px; margin: 0 3px 0 8px; }
  .book, .book-text { background: #2563eb; color: #2563eb; }
  .screen, .screen-text { background: #dc2626; color: #dc2626; }
  .labels, .calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
  .labels { margin-top: 12px; font-size: 11px; text-align: center; color: #6b7280; }
  .calendar { margin-top: 3px; }
  .day { min-height: 37px; padding: 3px; border: 1px solid #e5e7eb; border-radius: 4px; }
  .empty { border-color: transparent; }
  .number { display: block; font-size: 12px; }
  .events { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
  .event { width: 7px; height: 7px; }
  h2 { margin: 14px 0 0; font-size: 14px; }
  ul { padding-left: 17px; }
  li { margin: 3px 0; }
  .book-text, .screen-text { background: none; font-weight: 600; }
  time { color: #6b7280; white-space: nowrap; }
</style>
</head>
<body>
<main>
  <h1>${monthNames[month - 1]} ${year}</h1>
  <p class="legend"><span class="dot book"></span>czytam <span class="dot screen"></span>oglądam</p>
  <div class="labels">${dayLabels.map((label) => `<span>${label}</span>`).join("")}</div>
  <div class="calendar">${cells.join("")}</div>
  <h2>W tym miesiącu</h2>
  ${list}
</main>
</body>
</html>`;

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
console.log(`Wyeksportowano ${sessions.length} sesji do ${output}`);
