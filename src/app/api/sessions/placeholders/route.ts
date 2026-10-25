import { NextResponse } from "next/server";
import { sqlite } from "@/db";
import { redundantPlaceholders, removeRedundantPlaceholders } from "@/db/placeholders";
import { serverError } from "@/lib/api-helpers";

/**
 * One-off cleanup of year-long placeholder sessions left next to a real session of the same year
 * (runs inside the app; the server has no sqlite CLI).
 * GET  /api/sessions/placeholders — preview
 * POST /api/sessions/placeholders — delete them
 */
export async function GET() {
  try {
    const items = redundantPlaceholders(sqlite);
    return NextResponse.json({ count: items.length, items });
  } catch (error) {
    console.error(error);
    return serverError("Failed to list placeholder sessions");
  }
}

export async function POST() {
  try {
    return NextResponse.json({ removed: removeRedundantPlaceholders(sqlite) });
  } catch (error) {
    console.error(error);
    return serverError("Failed to remove placeholder sessions");
  }
}
