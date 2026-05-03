import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

const VALID_MEDIA_TYPES = ["book", "comic", "movie", "series", "anime", "cartoon"];

export async function GET() {
  try {
    const items = sqlite.prepare(`
      SELECT * FROM wishlist ORDER BY added_at DESC
    `).all();
    return NextResponse.json(items);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch wishlist" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, author, media_type, notes, cover_url } = body;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!VALID_MEDIA_TYPES.includes(media_type)) {
      return NextResponse.json({ error: "Invalid media_type" }, { status: 400 });
    }

    const result = sqlite.prepare(`
      INSERT INTO wishlist (title, author, media_type, notes, priority, cover_url)
      VALUES (?, ?, ?, ?, 'normal', ?)
    `).run(title, author || null, media_type, notes || null, cover_url || null);

    return NextResponse.json({ id: result.lastInsertRowid, message: "Dodano do listy" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to add to wishlist" }, { status: 500 });
  }
}
