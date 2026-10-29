import { NextResponse } from "next/server";
import { sqlite } from "@/db";

/** GET /api/sessions/first-year → { year: 2005 } — the oldest year with a logged session (null when none), the year switcher's lower bound */
export async function GET() {
  try {
    const row = sqlite.prepare(`
      SELECT MIN(substr(se.start_date,1,4)) AS year
      FROM sessions se JOIN seasons s ON se.season_id = s.id
      WHERE s.want_to_watch = 0
    `).get() as { year: string | null };
    return NextResponse.json({ year: row.year ? parseInt(row.year) : null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch first year" }, { status: 500 });
  }
}
