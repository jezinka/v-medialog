import { NextResponse } from "next/server";
import { sqlite } from "@/db";

export interface CalendarEntry {
  media_id: number;
  title: string;
  media_type: string;
  cover_url: string;
  month: number;
  assigned_day: number;
  is_placeholder: boolean;
  cinema: boolean;
}

/**
 * GET /api/calendar-gallery?year=YYYY
 *
 * Returns at most one cover per season for the whole year.
 * Seasons with real (non-placeholder) sessions are placed in their canonical month.
 * Seasons that only have year-placeholder sessions (duration ≥ 364 days) are placed
 * on any remaining empty slot across the year and marked is_placeholder=true.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));

  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;

  try {
    // Fetch ALL sessions overlapping the year (placeholders included)
    const rows = sqlite.prepare(`
      SELECT
        sn.id                                     AS season_id,
        m.id                                      AS media_id,
        m.title,
        m.media_type,
        COALESCE(sn.cover_url, m.cover_url)       AS cover_url,
        se.start_date,
        se.end_date,
        se.cinema,
        CAST(julianday(COALESCE(se.end_date, se.start_date))
             - julianday(se.start_date) AS INTEGER) AS duration_days
      FROM sessions se
      JOIN seasons sn ON se.season_id = sn.id
      JOIN media m    ON sn.media_id  = m.id
      WHERE se.start_date <= ?
        AND COALESCE(se.end_date, se.start_date) >= ?
        AND COALESCE(sn.cover_url, m.cover_url) IS NOT NULL
        AND sn.want_to_watch = 0
      ORDER BY se.start_date ASC
    `).all(yearEnd, yearStart) as {
      season_id: number;
      media_id: number;
      title: string;
      media_type: string;
      cover_url: string;
      start_date: string;
      end_date: string | null;
      cinema: number;
      duration_days: number;
    }[];

    type SeasonEntry = {
      season_id: number;
      media_id: number;
      title: string;
      media_type: string;
      cover_url: string;
      is_movie: boolean;
      is_placeholder: boolean;
      canonical_month: number;
      valid_days: number[];
      cinema: boolean;
    };

    const seasonMap = new Map<number, SeasonEntry>();

    for (const row of rows) {
      const isPlaceholderSession = row.duration_days >= 364;
      const sessionEnd = row.end_date ?? row.start_date;

      if (!seasonMap.has(row.season_id)) {
        // Will be refined below; start with placeholder assumption
        seasonMap.set(row.season_id, {
          season_id: row.season_id,
          media_id: row.media_id,
          title: row.title,
          media_type: row.media_type,
          cover_url: row.cover_url,
          is_movie: row.media_type === "movie",
          is_placeholder: true,
          canonical_month: 0,
          valid_days: [],
          cinema: false,
        });
      }

      const entry = seasonMap.get(row.season_id)!;

      if (isPlaceholderSession) continue; // don't use placeholder sessions for day assignment

      // Track cinema flag
      if (row.cinema) entry.cinema = true;

      // This season has at least one real session → not a placeholder
      if (entry.is_placeholder) {
        entry.is_placeholder = false;
        // Set canonical_month from the first real session encountered
        const effectiveStart = row.start_date < yearStart ? yearStart : row.start_date;
        entry.canonical_month = parseInt(effectiveStart.slice(5, 7));
      }

      const monthStr = String(entry.canonical_month).padStart(2, "0");
      const firstDayOfMonth = `${year}-${monthStr}-01`;
      const lastDayNum = new Date(year, entry.canonical_month, 0).getDate();
      const lastDayOfMonth = `${year}-${monthStr}-${String(lastDayNum).padStart(2, "0")}`;

      if (row.start_date > lastDayOfMonth || sessionEnd < firstDayOfMonth) continue;

      if (entry.is_movie) {
        const startInMonth = row.start_date >= firstDayOfMonth && row.start_date <= lastDayOfMonth;
        const dayNum = startInMonth
          ? parseInt(row.start_date.slice(8))
          : parseInt(firstDayOfMonth.slice(8));
        if (!entry.valid_days.includes(dayNum)) entry.valid_days.push(dayNum);
      } else {
        const clampedStart = row.start_date < firstDayOfMonth ? firstDayOfMonth : row.start_date;
        const clampedEnd = sessionEnd > lastDayOfMonth ? lastDayOfMonth : sessionEnd;
        const startDayNum = parseInt(clampedStart.slice(8));
        const endDayNum = parseInt(clampedEnd.slice(8));
        for (let d = startDayNum; d <= endDayNum; d++) {
          if (!entry.valid_days.includes(d)) entry.valid_days.push(d);
        }
      }
    }

    // Split into real seasons and placeholder-only seasons
    const realEntries = Array.from(seasonMap.values())
      .filter((e) => !e.is_placeholder)
      .sort((a, b) => {
        if (a.is_movie !== b.is_movie) return a.is_movie ? -1 : 1;
        if (a.canonical_month !== b.canonical_month) return a.canonical_month - b.canonical_month;
        return (a.valid_days[0] ?? 0) - (b.valid_days[0] ?? 0);
      });

    const placeholderEntries = Array.from(seasonMap.values())
      .filter((e) => e.is_placeholder)
      .sort((a, b) => a.title.localeCompare(b.title));

    // Precompute days-in-month for each month
    const daysInMonth = Array.from({ length: 12 }, (_, i) =>
      new Date(year, i + 1, 0).getDate()
    );

    // Greedy assignment for real entries
    const occupiedPerMonth = new Map<number, Set<number>>();
    const getOccupied = (m: number) => {
      if (!occupiedPerMonth.has(m)) occupiedPerMonth.set(m, new Set());
      return occupiedPerMonth.get(m)!;
    };

    const result: CalendarEntry[] = [];

    for (const entry of realEntries) {
      if (entry.valid_days.length === 0) continue;
      const occupied = getOccupied(entry.canonical_month);
      const day = entry.valid_days.find((d) => !occupied.has(d));
      if (day !== undefined) {
        occupied.add(day);
        result.push({
          media_id: entry.media_id,
          title: entry.title,
          media_type: entry.media_type,
          cover_url: entry.cover_url,
          month: entry.canonical_month,
          assigned_day: day,
          is_placeholder: false,
          cinema: entry.cinema,
        });
      }
    }

    // Greedy assignment for placeholder-only entries — any empty slot in the year
    for (const entry of placeholderEntries) {
      let placed = false;
      for (let m = 1; m <= 12 && !placed; m++) {
        const occupied = getOccupied(m);
        for (let d = 1; d <= daysInMonth[m - 1] && !placed; d++) {
          if (!occupied.has(d)) {
            occupied.add(d);
            result.push({
              media_id: entry.media_id,
              title: entry.title,
              media_type: entry.media_type,
              cover_url: entry.cover_url,
              month: m,
              assigned_day: d,
              is_placeholder: true,
              cinema: false,
            });
            placed = true;
          }
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch calendar gallery" }, { status: 500 });
  }
}
