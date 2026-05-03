import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

const PLACEHOLDER_SQL =
  `SELECT id FROM sessions WHERE season_id=? AND start_date LIKE '%-01-01' AND (end_date LIKE '%-12-31' OR end_date IS NULL) AND substr(start_date,1,4)=COALESCE(substr(end_date,1,4), substr(start_date,1,4))`;

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const seasonId = parseInt(id, 10);
    if (isNaN(seasonId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const rows = sqlite.prepare(PLACEHOLDER_SQL).all(seasonId) as { id: number }[];
    for (const row of rows) {
      sqlite.prepare(`DELETE FROM sessions WHERE id=?`).run(row.id);
    }

    return NextResponse.json({ removed: rows.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to remove placeholders" }, { status: 500 });
  }
}
