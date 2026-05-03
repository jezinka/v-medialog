import { NextResponse } from "next/server";
import { sqlite } from "@/db";

export interface WatchlistEntry {
  media_id: number;
  season_id: number;
  title: string;
  media_type: string;
  cover_url: string | null;
  last_session_date: string | null;
  /** "future" = last_session_date > today, "past" = in past, "no_date" = no sessions */
  category: "future" | "past" | "no_date";
}

/**
 * GET /api/watchlist-calendar
 *
 * Returns all seasons with want_to_watch = 1, categorized as:
 *  - future:  last session date is in the future
 *  - past:    last session date is in the past (already aired, plan to watch)
 *  - no_date: no sessions at all (no announced date yet)
 */
export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const rows = sqlite.prepare(`
      SELECT
        m.id            AS media_id,
        sn.id           AS season_id,
        m.title,
        m.media_type,
        COALESCE(sn.cover_url, m.cover_url) AS cover_url,
        MAX(se.start_date) AS last_session_date
      FROM seasons sn
      JOIN media m ON sn.media_id = m.id
      LEFT JOIN sessions se ON se.season_id = sn.id
        AND CAST(julianday(COALESCE(se.end_date, se.start_date)) - julianday(se.start_date) AS INTEGER) < 364
      WHERE sn.want_to_watch = 1
      GROUP BY sn.id
      ORDER BY m.title ASC
    `).all() as {
      media_id: number;
      season_id: number;
      title: string;
      media_type: string;
      cover_url: string | null;
      last_session_date: string | null;
    }[];

    const result: WatchlistEntry[] = rows.map((row) => {
      let category: WatchlistEntry["category"];
      if (!row.last_session_date) {
        category = "no_date";
      } else if (row.last_session_date > today) {
        category = "future";
      } else {
        category = "past";
      }
      return { ...row, category };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch watchlist calendar" }, { status: 500 });
  }
}
