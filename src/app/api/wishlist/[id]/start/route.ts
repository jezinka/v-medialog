import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { parseRouteId, jsonError } from "@/lib/api-helpers";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const numId = await parseRouteId(params);

    const item = sqlite.prepare(`SELECT * FROM wishlist WHERE id=?`).get(numId) as {
      id: number; title: string; author: string | null; media_type: string;
      notes: string | null; priority: string; added_at: string;
    } | undefined;

    if (!item) return jsonError("Wishlist item not found", 404);

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
    return jsonError("Failed to start media", 500);
  }
}
