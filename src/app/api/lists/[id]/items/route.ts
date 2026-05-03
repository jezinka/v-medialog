import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

const VALID_MEDIA_TYPES = ["book", "comic", "movie", "series", "anime", "cartoon"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const items = sqlite.prepare(`
      SELECT i.*, CASE WHEN i.media_id IS NOT NULL THEN 1 ELSE 0 END as completed
      FROM reading_list_items i
      WHERE i.list_id = ?
      ORDER BY i.created_at ASC
    `).all(parseInt(id));
    return NextResponse.json(items);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch list items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const listId = parseInt(id);
    const body = await request.json();
    const { title, author, media_type, cover_url } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!VALID_MEDIA_TYPES.includes(media_type)) {
      return NextResponse.json({ error: "Invalid media_type" }, { status: 400 });
    }

    const list = sqlite.prepare("SELECT id FROM reading_lists WHERE id=?").get(listId);
    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const result = sqlite.prepare(`
      INSERT INTO reading_list_items (list_id, title, author, media_type, cover_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(listId, title.trim(), author || null, media_type, cover_url || null);

    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}
