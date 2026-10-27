export const SEASON_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500",
  "bg-orange-500", "bg-pink-500", "bg-teal-500",
];

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Empty cells before day 1 in a Monday-first week (0 = Monday … 6 = Sunday) */
export function getFirstDayOfMonth(year: number, month: number): number {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

/** Day numbers of a month (1-12) preceded by nulls so the first day lands on its weekday, Monday first. */
export function monthCells(year: number, month: number): Array<number | null> {
  return [
    ...Array<null>(getFirstDayOfMonth(year, month)).fill(null),
    ...Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1),
  ];
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Maps every day covered by a session to its season's color; sessions spanning a year or more (placeholders) are skipped. */
export function buildSessionDaysMap(
  sessions: { season_id: number; start_date: string; end_date: string | null }[],
  seasons: { id: number }[]
): Map<string, string> {
  const result = new Map<string, string>();
  for (const session of sessions) {
    const seasonIdx = seasons.findIndex((s) => s.id === session.season_id);
    const color = SEASON_COLORS[(seasonIdx >= 0 ? seasonIdx : 0) % SEASON_COLORS.length];
    // "T00:00" parses as local midnight; a bare date is UTC and would shift a day west of UTC
    const start = new Date(`${session.start_date}T00:00`);
    const end = new Date(`${session.end_date ?? session.start_date}T00:00`);
    const spanDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1; // round: DST days are 23/25 h
    if (spanDays >= 365) continue;
    const cur = new Date(start);
    while (cur <= end) {
      result.set(dateKey(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()), color);
      cur.setDate(cur.getDate() + 1);
    }
  }
  return result;
}

/** Splits a date → color map into YYYY-MM → (date → color). */
export function groupByYearMonth(days: Map<string, string>): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>();
  for (const [d, color] of days) {
    const key = d.slice(0, 7);
    if (!map.has(key)) map.set(key, new Map());
    map.get(key)!.set(d, color);
  }
  return map;
}

/** Polish public holidays of a year (dateKey strings), including Easter-based ones and Christmas Eve. */
export function getPolishHolidays(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easter = new Date(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, (h + l - 7 * m + 114) % 31 + 1);
  const movable = (offset: number) => {
    const date = new Date(easter);
    date.setDate(date.getDate() + offset);
    return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
  };

  return new Set([
    dateKey(year, 1, 1), dateKey(year, 1, 6), dateKey(year, 5, 1), dateKey(year, 5, 3),
    dateKey(year, 8, 15), dateKey(year, 11, 1), dateKey(year, 11, 11),
    dateKey(year, 12, 24), dateKey(year, 12, 25), dateKey(year, 12, 26),
    movable(0), movable(1), movable(49), movable(60),
  ]);
}
