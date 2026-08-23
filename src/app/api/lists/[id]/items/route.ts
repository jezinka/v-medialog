import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { CALENDAR_TYPES } from "@/lib/utils";
import { badRequest, notFound, parseRouteId, serverError } from "@/lib/api-helpers";

const VALID_MEDIA_TYPES = CALENDAR_TYPES;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    const items = sqlite.prepare(`
      SELECT i.*, CASE WHEN i.media_id IS NOT NULL THEN 1 ELSE 0 END as completed
      FROM reading_list_items i
      WHERE i.list_id = ?
      ORDER BY i.created_at ASC
    `).all(id);
    return NextResponse.json(items);
  } catch (error) {
    console.error(error);
    return serverError("Failed to fetch list items");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const listId = await parseRouteId(params);
    const body = await request.json();
    const { title, author, media_type, cover_url } = body;

    if (!title || !title.trim()) {
      return badRequest("title is required");
    }
    if (!VALID_MEDIA_TYPES.includes(media_type)) {
      return badRequest("Invalid media_type");
    }

    const list = sqlite.prepare("SELECT id FROM reading_lists WHERE id=?").get(listId);
    if (!list) {
      return notFound("List not found");
    }

    const result = sqlite.prepare(`
      INSERT INTO reading_list_items (list_id, title, author, media_type, cover_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(listId, title.trim(), author || null, media_type, cover_url || null);

    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
  } catch (error) {
    console.error(error);
    return serverError("Failed to add item");
  }
}
