import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * GET /api/sessions?year=2025
 * GET /api/sessions?season_id=3
 * GET /api/sessions?media_id=7   (sessions across all seasons of a medium)
 * POST /api/sessions { season_id, start_date, end_date?, cinema? }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const seasonId = searchParams.get("season_id");
    const mediaId = searchParams.get("media_id");

    let query = `
      SELECT se.*,
        s.season_number, s.title as season_title, s.cover_url as season_cover_url,
        m.id as media_id, m.title as media_title, m.original_title as media_original_title,
        m.media_type, m.cover_url as media_cover_url, m.author,
        m.notes, m.tags, m.discontinued,
        u.id as universe_id, u.name as universe_name
      FROM sessions se
      JOIN seasons s ON se.season_id = s.id
      JOIN media m ON s.media_id = m.id
      LEFT JOIN universes u ON m.universe_id = u.id
      WHERE 1=1
    `;
    const args: (string | number)[] = [];

    if (seasonId) {
      query += ` AND se.season_id = ?`;
      args.push(parseInt(seasonId));
    } else if (mediaId) {
      query += ` AND m.id = ?`;
      args.push(parseInt(mediaId));
    } else if (year) {
      query += ` AND (substr(se.start_date,1,4) = ? OR substr(se.end_date,1,4) = ?)`;
      query += ` AND s.want_to_watch = 0`;
      args.push(year, year);
    }

    query += ` ORDER BY se.start_date DESC, se.id DESC`;

    const sessions = sqlite.prepare(query).all(...args);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { season_id, start_date, end_date, cinema } = await request.json();
    if (!season_id || !start_date) {
      return NextResponse.json({ error: "season_id and start_date are required" }, { status: 400 });
    }
    if (end_date && end_date < start_date) {
      return NextResponse.json({ error: "Data końca nie może być wcześniej niż data początku" }, { status: 400 });
    }

    // Verify season exists
    const seasonExists = sqlite.prepare(`SELECT id FROM seasons WHERE id=?`).get(Number(season_id));
    if (!seasonExists) return NextResponse.json({ error: `Season ${season_id} not found` }, { status: 404 });

    const r = sqlite.prepare(
      `INSERT INTO sessions (season_id, start_date, end_date, cinema) VALUES (?, ?, ?, ?)`
    ).run(Number(season_id), start_date, end_date ?? null, cinema ? 1 : 0);

    const newId = Number(r.lastInsertRowid);
    const created = sqlite.prepare(`SELECT * FROM sessions WHERE id=?`).get(newId) as Record<string, unknown> | undefined;
    if (!created) return NextResponse.json({ error: "Session not found after creation" }, { status: 500 });

    return NextResponse.json({
      id: Number(created.id),
      season_id: Number(created.season_id),
      start_date: created.start_date,
      end_date: created.end_date ?? null,
      cinema: Number(created.cinema),
      created_at: created.created_at ?? null,
    }, { status: 201 });
  } catch (error) {
    console.error("sessions POST error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
