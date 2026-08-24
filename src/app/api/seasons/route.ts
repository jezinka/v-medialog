import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * GET /api/seasons?media_id=5
 * POST /api/seasons  { media_id, season_number?, title?, cover_url? }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("media_id");
    if (!mediaId) return NextResponse.json({ error: "media_id is required" }, { status: 400 });

    const seasons = sqlite.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM sessions se WHERE se.season_id = s.id) as session_count,
        (SELECT MIN(se.start_date) FROM sessions se WHERE se.season_id = s.id) as first_session_date,
        (SELECT MAX(COALESCE(se.end_date, se.start_date)) FROM sessions se WHERE se.season_id = s.id) as last_session_date,
        (SELECT CASE WHEN EXISTS (
          SELECT 1 FROM sessions se WHERE se.season_id = s.id AND se.with_child = 1
        ) THEN 1 ELSE 0 END) as has_child_session,
        (SELECT CASE WHEN EXISTS (
          SELECT 1 FROM sessions se WHERE se.season_id = s.id AND se.cinema = 1
        ) THEN 1 ELSE 0 END) as has_cinema_session
      FROM seasons s
      WHERE s.media_id = ?
      ORDER BY first_session_date ASC NULLS LAST, s.season_number, s.id
    `).all(parseInt(mediaId));

    return NextResponse.json(seasons);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch seasons" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { media_id, season_number, title, cover_url } = await request.json();
    if (!media_id) return NextResponse.json({ error: "media_id is required" }, { status: 400 });

    // Verify media exists
    const mediaExists = sqlite.prepare(`SELECT id FROM media WHERE id=?`).get(media_id);
    if (!mediaExists) return NextResponse.json({ error: "Media not found" }, { status: 404 });

    const r = sqlite.prepare(
      `INSERT INTO seasons (media_id, season_number, title, cover_url, want_to_watch) VALUES (?, ?, ?, ?, 1)`
    ).run(media_id, season_number ?? null, title ?? null, cover_url ?? null);

    const newId = Number(r.lastInsertRowid);
    const created = sqlite.prepare(`SELECT * FROM seasons WHERE id=?`).get(newId) as Record<string, unknown> | undefined;
    if (!created) return NextResponse.json({ error: "Season not found after creation" }, { status: 500 });

    // Return plain serializable object (guards against BigInt/prototype issues)
    return NextResponse.json({
      id: Number(created.id),
      media_id: Number(created.media_id),
      season_number: created.season_number != null ? Number(created.season_number) : null,
      title: created.title ?? null,
      cover_url: created.cover_url ?? null,
      want_to_watch: Boolean(created.want_to_watch ?? true),
      created_at: created.created_at ?? null,
    }, { status: 201 });
  } catch (error) {
    console.error("seasons POST error:", error);
    return NextResponse.json({ error: "Failed to create season" }, { status: 500 });
  }
}
