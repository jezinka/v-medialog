import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { badRequest, serverError } from "@/lib/api-helpers";
import { monthKey, monthRange } from "@/lib/schedule";

export interface ScheduleItem {
  media_id: number;
  season_id: number;
  season_number: number | null;
  season_title: string | null;
  title: string;
  media_type: string;
  cover_url: string | null;
  air_date: string;
}

/**
 * GET /api/schedule?month=YYYY-MM (default: this month)
 * Season premieres of series and anime in that month: seasons on the watch list whose premiere
 * marker session falls in it (the upcoming-seasons job adds them). `seen` says whether the bell
 * entry for the month was dismissed.
 */
export async function GET(request: NextRequest) {
  try {
    const month = new URL(request.url).searchParams.get("month") ?? monthKey(new Date());
    const range = monthRange(month);
    if (!range) return badRequest("month must be YYYY-MM");

    const items = sqlite.prepare(`
      SELECT m.id AS media_id, sn.id AS season_id, sn.season_number, sn.title AS season_title,
             m.title, m.media_type, COALESCE(sn.cover_url, m.cover_url) AS cover_url,
             MIN(se.start_date) AS air_date
      FROM seasons sn
      JOIN media m ON m.id = sn.media_id
      JOIN sessions se ON se.season_id = sn.id
      WHERE sn.want_to_watch = 1 AND m.media_type IN ('series', 'anime')
      GROUP BY sn.id
      HAVING air_date BETWEEN ? AND ?
      ORDER BY air_date, m.title
    `).all(range.first, range.last) as ScheduleItem[];

    const seen = sqlite.prepare(`SELECT value FROM settings WHERE key='schedule_seen_month'`).get() as { value: string } | undefined;
    return NextResponse.json({ month, items, seen: seen?.value === month });
  } catch (error) {
    console.error(error);
    return serverError("Failed to load schedule");
  }
}

/** POST /api/schedule { month } — dismisses the bell entry for that month */
export async function POST(request: NextRequest) {
  try {
    const { month } = await request.json() as { month?: string };
    if (!month || !monthRange(month)) return badRequest("month must be YYYY-MM");
    sqlite.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('schedule_seen_month', ?)`).run(month);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return serverError("Failed to save");
  }
}
