import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const universe = sqlite.prepare(`SELECT * FROM universes WHERE id=?`).get(parseInt(id));
    if (!universe) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const media = sqlite.prepare(
      `SELECT id, title, original_title, media_type, cover_url, release_year, discontinued FROM media WHERE universe_id=? ORDER BY title`
    ).all(parseInt(id));

    return NextResponse.json({ ...universe as object, media });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch universe" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, description, cover_url } = await request.json();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    sqlite.prepare(
      `UPDATE universes SET name=?, description=?, cover_url=?, updated_at=datetime('now') WHERE id=?`
    ).run(name, description ?? null, cover_url ?? null, parseInt(id));

    return NextResponse.json(sqlite.prepare(`SELECT * FROM universes WHERE id=?`).get(parseInt(id)));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update universe" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Unlink media before deleting
    sqlite.prepare(`UPDATE media SET universe_id=NULL WHERE universe_id=?`).run(parseInt(id));
    sqlite.prepare(`DELETE FROM universes WHERE id=?`).run(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete universe" }, { status: 500 });
  }
}
