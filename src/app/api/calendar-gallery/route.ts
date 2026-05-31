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
 * GET /api/calendar-gallery?year=YYYY&types=book,movie
 *
 * Returns at most one cover per season for the whole year.
 * Seasons with real (non-placeholder) sessions are placed in their canonical month.
 * Seasons that only have year-placeholder sessions (duration ≥ 364 days) are placed
 * on any remaining empty slot across the year and marked is_placeholder=true.
 * Optional `types` param (comma-separated) filters by media_type.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));
  const typesParam = searchParams.get("types");
  const typeFilter = typesParam ? typesParam.split(",").map((t) => t.trim()).filter(Boolean) : null;

  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;

  try {
    // Fetch ALL sessions overlapping the year (placeholders included)
    // YT videos are always excluded (they clutter the calendar)
    const typeClause = typeFilter && typeFilter.length > 0
      ? `AND m.media_type IN (${typeFilter.map(() => "?").join(",")})`
      : "AND m.media_type != 'yt'";
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
        ${typeClause}
      ORDER BY se.start_date ASC
    `).all(yearEnd, yearStart, ...(typeFilter ?? [])) as {
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

      if (isPlaceholderSession) continue;

      if (row.cinema) entry.cinema = true;

      if (entry.is_placeholder) {
        entry.is_placeholder = false;
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

    // Split real vs placeholder
    const allReal = Array.from(seasonMap.values()).filter((e) => !e.is_placeholder);
    const placeholderEntries = Array.from(seasonMap.values()).filter((e) => e.is_placeholder)
      .sort((a, b) => a.title.localeCompare(b.title));

    // Precompute days-in-month
    const daysInMonth = Array.from({ length: 12 }, (_, i) =>
      new Date(year, i + 1, 0).getDate()
    );

    const occupiedPerMonth = new Map<number, Set<number>>();
    const getOccupied = (m: number) => {
      if (!occupiedPerMonth.has(m)) occupiedPerMonth.set(m, new Set());
      return occupiedPerMonth.get(m)!;
    };

    /** Find nearest free slot in canonical month only, then optionally year-wide. */
    function findSlot(
      canonicalMonth: number,
      validDays: number[],
    ): { month: number; day: number } | null {
      const occupied = getOccupied(canonicalMonth);

      for (const d of validDays) {
        if (!occupied.has(d)) return { month: canonicalMonth, day: d };
      }

      const monthDays = daysInMonth[canonicalMonth - 1];
      const midDay = validDays.length > 0
        ? validDays[Math.floor(validDays.length / 2)]
        : Math.ceil(monthDays / 2);
      for (let dist = 1; dist <= monthDays; dist++) {
        for (const d of [midDay + dist, midDay - dist]) {
          if (d >= 1 && d <= monthDays && !occupied.has(d)) {
            return { month: canonicalMonth, day: d };
          }
        }
      }

      for (let m = 1; m <= 12; m++) {
        if (m === canonicalMonth) continue;
        const occ = getOccupied(m);
        for (let d = 1; d <= daysInMonth[m - 1]; d++) {
          if (!occ.has(d)) return { month: m, day: d };
        }
      }

      return null;
    }

    // Sort: cinema first, then single-day entries (no flexibility), then movies, then by month/day
    const sortedEntries = allReal
      .sort((a, b) => {
        if (a.cinema !== b.cinema) return a.cinema ? -1 : 1;
        const aSingle = a.valid_days.length === 1 ? 0 : 1;
        const bSingle = b.valid_days.length === 1 ? 0 : 1;
        if (aSingle !== bSingle) return aSingle - bSingle;
        if (a.is_movie !== b.is_movie) return a.is_movie ? -1 : 1;
        if (a.canonical_month !== b.canonical_month) return a.canonical_month - b.canonical_month;
        return (a.valid_days[0] ?? 0) - (b.valid_days[0] ?? 0);
      });

    const result: CalendarEntry[] = [];

    for (const entry of sortedEntries) {
      if (entry.valid_days.length === 0) continue;
      const slot = findSlot(entry.canonical_month, entry.valid_days);
      if (slot !== null) {
        getOccupied(slot.month).add(slot.day);
        result.push({
          media_id: entry.media_id,
          title: entry.title,
          media_type: entry.media_type,
          cover_url: entry.cover_url,
          month: slot.month,
          assigned_day: slot.day,
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
