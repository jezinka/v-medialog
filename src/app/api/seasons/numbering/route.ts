import { NextResponse } from "next/server";
import { sqlite } from "@/db";
import { applySeasonNumbering, seasonNumberingPlan } from "@/db/season-numbering";
import { serverError } from "@/lib/api-helpers";

/**
 * One-off backfill of season numbers (runs inside the app; the server has no sqlite CLI).
 * GET  /api/seasons/numbering — preview: media and the numbers their unnumbered seasons would get
 * POST /api/seasons/numbering — apply; media with clashes (changes: null) are skipped
 */
export async function GET() {
  try {
    const plan = seasonNumberingPlan(sqlite);
    return NextResponse.json({
      media: plan.length,
      seasons: plan.reduce((n, e) => n + (e.changes?.length ?? 0), 0),
      clashes: plan.filter((e) => !e.changes).map((e) => ({ media_id: e.media_id, title: e.title })),
      plan,
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to build season numbering plan");
  }
}

export async function POST() {
  try {
    const plan = seasonNumberingPlan(sqlite);
    return NextResponse.json({ numbered: applySeasonNumbering(sqlite, plan) });
  } catch (error) {
    console.error(error);
    return serverError("Failed to apply season numbering");
  }
}
