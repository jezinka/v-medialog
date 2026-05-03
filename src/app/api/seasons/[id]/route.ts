import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const season = sqlite.prepare(`SELECT * FROM seasons WHERE id=?`).get(parseInt(id));
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const sessions = sqlite.prepare(
      `SELECT * FROM sessions WHERE season_id=? ORDER BY start_date`
    ).all(parseInt(id));

    return NextResponse.json({ ...season as object, sessions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch season" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { season_number, title, cover_url, want_to_watch } = await request.json();

    sqlite.prepare(
      `UPDATE seasons SET season_number=?, title=?, cover_url=?${want_to_watch !== undefined ? ", want_to_watch=?" : ""} WHERE id=?`
    ).run(
      ...(want_to_watch !== undefined
        ? [season_number ?? null, title ?? null, cover_url ?? null, want_to_watch ? 1 : 0, parseInt(id)]
        : [season_number ?? null, title ?? null, cover_url ?? null, parseInt(id)])
    );

    return NextResponse.json(sqlite.prepare(`SELECT * FROM seasons WHERE id=?`).get(parseInt(id)));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update season" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    sqlite.prepare(`DELETE FROM seasons WHERE id=?`).run(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete season" }, { status: 500 });
  }
}
