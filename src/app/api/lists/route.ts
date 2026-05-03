import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function GET() {
  try {
    const lists = sqlite.prepare(`
      SELECT
        l.*,
        COUNT(i.id) as item_count,
        COUNT(i.media_id) as completed_count
      FROM reading_lists l
      LEFT JOIN reading_list_items i ON i.list_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `).all();
    return NextResponse.json(lists);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const result = sqlite.prepare(`
      INSERT INTO reading_lists (name, description) VALUES (?, ?)
    `).run(name.trim(), description || null);

    return NextResponse.json({ id: result.lastInsertRowid, message: "Utworzono listę" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }
}
