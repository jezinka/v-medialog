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
