import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function GET() {
  try {
    const rows = sqlite.prepare(
      `SELECT u.*, (SELECT COUNT(*) FROM media m WHERE m.universe_id = u.id) as media_count
       FROM universes u ORDER BY u.name`
    ).all();
    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch universes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, cover_url, media_ids } = await request.json();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const mediaIds = Array.isArray(media_ids) ? media_ids.filter(Number.isInteger) as number[] : [];

    // Optional media_ids join the new universe in the same transaction
    const id = sqlite.transaction(() => {
      const r = sqlite.prepare(
        `INSERT INTO universes (name, description, cover_url) VALUES (?, ?, ?)`
      ).run(name, description ?? null, cover_url ?? null);
      const link = sqlite.prepare(`UPDATE media SET universe_id=?, updated_at=datetime('now') WHERE id=?`);
      for (const mediaId of mediaIds) link.run(r.lastInsertRowid, mediaId);
      return r.lastInsertRowid;
    })();

    return NextResponse.json(
      sqlite.prepare(`SELECT * FROM universes WHERE id=?`).get(id),
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create universe" }, { status: 500 });
  }
}
