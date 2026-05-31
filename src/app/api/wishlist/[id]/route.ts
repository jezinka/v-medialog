import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { VALID_WISHLIST_MEDIA_TYPES, parseRouteId, jsonError } from "@/lib/api-helpers";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const numId = await parseRouteId(params);
    const body = await request.json();
    const { title, author, media_type, notes, cover_url } = body;

    if (title !== undefined && !title) return jsonError("title cannot be empty", 400);
    if (media_type && !VALID_WISHLIST_MEDIA_TYPES.includes(media_type)) return jsonError("Invalid media_type", 400);

    sqlite.prepare(`
      UPDATE wishlist SET title=?, author=?, media_type=?, notes=?, cover_url=?
      WHERE id=?
    `).run(title, author || null, media_type, notes || null, cover_url || null, numId);

    const updated = sqlite.prepare("SELECT * FROM wishlist WHERE id=?").get(numId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return jsonError("Failed to update wishlist item", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const numId = await parseRouteId(params);
    sqlite.prepare("DELETE FROM wishlist WHERE id=?").run(numId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return jsonError("Failed to delete wishlist item", 500);
  }
}

