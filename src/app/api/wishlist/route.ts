import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { VALID_WISHLIST_MEDIA_TYPES, jsonError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const items = sqlite.prepare(`
      SELECT * FROM wishlist ORDER BY added_at DESC
    `).all();
    return NextResponse.json(items);
  } catch (error) {
    console.error(error);
    return jsonError("Failed to fetch wishlist", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, author, media_type, notes, cover_url } = body;

    if (!title) return jsonError("title is required", 400);
    if (!VALID_WISHLIST_MEDIA_TYPES.includes(media_type)) return jsonError("Invalid media_type", 400);

    const result = sqlite.prepare(`
      INSERT INTO wishlist (title, author, media_type, notes, priority, cover_url)
      VALUES (?, ?, ?, ?, 'normal', ?)
    `).run(title, author || null, media_type, notes || null, cover_url || null);

    return NextResponse.json({ id: result.lastInsertRowid, message: "Dodano do listy" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return jsonError("Failed to add to wishlist", 500);
  }
}
