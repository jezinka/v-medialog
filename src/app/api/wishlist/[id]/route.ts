import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

const VALID_MEDIA_TYPES = ["book", "comic", "movie", "series", "anime", "cartoon"];

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = parseInt(id);
    const body = await request.json();
    const { title, author, media_type, notes, cover_url } = body;

    if (title !== undefined && !title) {
      return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    }
    if (media_type && !VALID_MEDIA_TYPES.includes(media_type)) {
      return NextResponse.json({ error: "Invalid media_type" }, { status: 400 });
    }

    sqlite.prepare(`
      UPDATE wishlist SET title=?, author=?, media_type=?, notes=?, cover_url=?
      WHERE id=?
    `).run(title, author || null, media_type, notes || null, cover_url || null, numId);

    const updated = sqlite.prepare("SELECT * FROM wishlist WHERE id=?").get(numId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update wishlist item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    sqlite.prepare("DELETE FROM wishlist WHERE id=?").run(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete wishlist item" }, { status: 500 });
  }
}

