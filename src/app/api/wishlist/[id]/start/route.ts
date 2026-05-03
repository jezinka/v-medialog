import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = parseInt(id);

    const item = sqlite.prepare(`SELECT * FROM wishlist WHERE id=?`).get(numId) as {
      id: number; title: string; author: string | null; media_type: string;
      notes: string | null; priority: string; added_at: string;
    } | undefined;

    if (!item) return NextResponse.json({ error: "Wishlist item not found" }, { status: 404 });

    const today = new Date().toISOString().split("T")[0];

    const mediaRes = sqlite.prepare(
      `INSERT INTO media (title, author, media_type, discontinued) VALUES (?, ?, ?, 0)`
    ).run(item.title, item.author ?? null, item.media_type);
    const mediaId = mediaRes.lastInsertRowid as number;

    const seasonRes = sqlite.prepare(
      `INSERT INTO seasons (media_id, season_number) VALUES (?, NULL)`
    ).run(mediaId);
    const seasonId = seasonRes.lastInsertRowid as number;

    sqlite.prepare(
      `INSERT INTO sessions (season_id, start_date) VALUES (?, ?)`
    ).run(seasonId, today);

    sqlite.prepare(`DELETE FROM wishlist WHERE id=?`).run(numId);

    return NextResponse.json({ mediaId, message: "Przeniesiono do dziennika" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to start media" }, { status: 500 });
  }
}
