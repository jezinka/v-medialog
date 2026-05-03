import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * POST /api/sessions/reassign
 * Body: {
 *   session_ids: number[],      — sessions to move
 *   target_season_id?: number,  — existing season to move to
 *   new_season?: {              — OR create new season
 *     media_id: number,
 *     season_number?: number,
 *     title?: string,
 *     cover_url?: string,
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      session_ids: number[];
      target_season_id?: number;
      new_season?: { media_id: number; season_number?: number; title?: string; cover_url?: string };
    };

    const { session_ids, target_season_id, new_season } = body;
    if (!session_ids?.length) return NextResponse.json({ error: "session_ids required" }, { status: 400 });
    if (!target_season_id && !new_season) return NextResponse.json({ error: "target_season_id or new_season required" }, { status: 400 });

    const doReassign = sqlite.transaction(() => {
      let seasonId: number;
      if (target_season_id) {
        seasonId = target_season_id;
      } else {
        const res = sqlite.prepare(
          `INSERT INTO seasons (media_id, season_number, title, cover_url) VALUES (?, ?, ?, ?)`
        ).run(
          new_season!.media_id,
          new_season!.season_number ?? null,
          new_season!.title ?? null,
          new_season!.cover_url ?? null,
        );
        seasonId = Number(res.lastInsertRowid);
      }
      for (const sid of session_ids) {
        sqlite.prepare(`UPDATE sessions SET season_id=? WHERE id=?`).run(seasonId, sid);
      }
      return seasonId;
    });

    const seasonId = doReassign();
    return NextResponse.json({ season_id: seasonId, moved: session_ids.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Reassign failed" }, { status: 500 });
  }
}
