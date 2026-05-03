import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { itemId } = await params;
    const numItemId = parseInt(itemId);

    const item = sqlite.prepare(`SELECT * FROM reading_list_items WHERE id=?`).get(numItemId) as {
      id: number; list_id: number; title: string; author: string | null;
      media_type: string; cover_url: string | null; media_id: number | null;
    } | undefined;

    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    if (item.media_id) return NextResponse.json({ error: "Już rozpoczęto" }, { status: 400 });

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
    return NextResponse.json({ error: "Failed to start item" }, { status: 500 });
  }
}
