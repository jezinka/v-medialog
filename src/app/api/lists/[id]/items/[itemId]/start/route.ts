import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { badRequest, notFound, parseId, serverError } from "@/lib/api-helpers";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { itemId } = await params;
    const numItemId = parseId(itemId);
    if (numItemId == null) return badRequest("Invalid itemId");

    const item = sqlite.prepare(`SELECT * FROM reading_list_items WHERE id=?`).get(numItemId) as {
      id: number; list_id: number; title: string; author: string | null;
      media_type: string; cover_url: string | null; media_id: number | null;
    } | undefined;

    if (!item) return notFound("Item not found");
    if (item.media_id) return badRequest("Już rozpoczęto");

    const today = new Date().toISOString().split("T")[0];

    const mediaRes = sqlite.prepare(
      `INSERT INTO media (title, author, media_type, cover_url, discontinued) VALUES (?, ?, ?, ?, 0)`
    ).run(item.title, item.author ?? null, item.media_type, item.cover_url ?? null);
    const mediaId = mediaRes.lastInsertRowid as number;

    const seasonRes = sqlite.prepare(
      `INSERT INTO seasons (media_id, season_number) VALUES (?, NULL)`
    ).run(mediaId);
    const seasonId = seasonRes.lastInsertRowid as number;

    sqlite.prepare(`INSERT INTO sessions (season_id, start_date) VALUES (?, ?)`).run(seasonId, today);
    sqlite.prepare(`UPDATE reading_list_items SET media_id=? WHERE id=?`).run(mediaId, numItemId);

    return NextResponse.json({ mediaId, message: "Przeniesiono do dziennika" });
  } catch (error) {
    console.error(error);
    return serverError("Failed to start item");
  }
}
