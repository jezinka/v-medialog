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
    const { name, description, cover_url } = await request.json();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const r = sqlite.prepare(
      `INSERT INTO universes (name, description, cover_url) VALUES (?, ?, ?)`
    ).run(name, description ?? null, cover_url ?? null);

    return NextResponse.json(
      sqlite.prepare(`SELECT * FROM universes WHERE id=?`).get(r.lastInsertRowid),
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create universe" }, { status: 500 });
  }
}
