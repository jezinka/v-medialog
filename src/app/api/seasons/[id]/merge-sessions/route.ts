import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

interface SessionRecord {
  id: number;
  start_date: string;
  end_date: string | null;
  cinema: number;
}

/**
 * POST /api/seasons/[id]/merge-sessions
 * Merges consecutive/overlapping sessions within a season into single sessions.
 * Two sessions are merged if end_date+1 >= next start_date (i.e., consecutive or overlapping).
 * Returns { merged: number } — number of sessions removed by merging.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const seasonId = parseInt(id);

    const doMerge = sqlite.transaction(() => {
      const sessions = sqlite.prepare(
        `SELECT id, start_date, end_date, cinema FROM sessions WHERE season_id=? ORDER BY start_date ASC, id ASC`
      ).all(seasonId) as SessionRecord[];

      if (sessions.length === 0) return 0;

      // Build merged groups: each group is [startDate, endDate, cinema, ids[]]
      type Group = { start: string; end: string; cinema: number; ids: number[] };
      const groups: Group[] = [];

      for (const s of sessions) {
        const end = s.end_date ?? s.start_date;
        if (groups.length === 0) {
          groups.push({ start: s.start_date, end, cinema: s.cinema, ids: [s.id] });
          continue;
        }
        const last = groups[groups.length - 1];
        // Compute lastEnd + 1 day
        const lastEndDate = new Date(last.end);
        lastEndDate.setDate(lastEndDate.getDate() + 1);
        const nextDay = lastEndDate.toISOString().slice(0, 10);

        if (s.start_date <= nextDay) {
          // Consecutive or overlapping — extend the current group
          if (end > last.end) last.end = end;
          last.ids.push(s.id);
        } else {
          groups.push({ start: s.start_date, end, cinema: s.cinema, ids: [s.id] });
        }
      }

      let removed = 0;
      for (const g of groups) {
        if (g.ids.length <= 1) continue;
        // Keep the first session (smallest id), update its dates, delete the rest
        const [keepId, ...deleteIds] = g.ids;
        sqlite.prepare(`UPDATE sessions SET start_date=?, end_date=? WHERE id=?`).run(g.start, g.end, keepId);
        for (const delId of deleteIds) {
          sqlite.prepare(`DELETE FROM sessions WHERE id=?`).run(delId);
          removed++;
        }
      }
      return removed;
    });

    const merged = doMerge();
    return NextResponse.json({ merged, message: merged > 0 ? `Scalono ${merged} sesji` : "Brak sesji do scalenia" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Merge failed" }, { status: 500 });
  }
}
