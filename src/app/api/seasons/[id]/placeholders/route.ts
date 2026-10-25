import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { removeAllPlaceholders } from "@/db/placeholders";

/** Explicit "🗑📅" action: delete the season's year-long placeholder sessions (YYYY-01-01 → YYYY-12-31). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const seasonId = parseInt(id, 10);
    if (isNaN(seasonId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    return NextResponse.json({ removed: removeAllPlaceholders(sqlite, seasonId) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to remove placeholders" }, { status: 500 });
  }
}
