/** "YYYY-MM" of a local date */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** First and last day ("YYYY-MM-DD") of a "YYYY-MM" month; null for anything else */
export function monthRange(month: string): { first: string; last: string } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const lastDay = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  return { first: `${month}-01`, last: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/** The month `delta` months away from "YYYY-MM" */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

/** Upcoming seasons are re-checked when the last check is a week old or from an earlier month. */
export function upcomingCheckDue(lastCheck: string | null, now: Date): boolean {
  if (!lastCheck) return true;
  const last = new Date(lastCheck);
  if (Number.isNaN(last.getTime())) return true;
  return monthKey(last) !== monthKey(now) || now.getTime() - last.getTime() >= 7 * 24 * 3_600_000;
}

/** Items grouped by air date, in date order */
export function groupByDate<T extends { air_date: string }>(items: T[]): Array<{ date: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => a.air_date.localeCompare(b.air_date))) {
    if (!map.has(item.air_date)) map.set(item.air_date, []);
    map.get(item.air_date)!.push(item);
  }
  return [...map].map(([date, grouped]) => ({ date, items: grouped }));
}
