import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { parseTagsInput, setMediaTags, getMediaTags } from "@/lib/tags";

/**
 * GET /api/media?year=2025
 * GET /api/media?universe_id=3
 * GET /api/media?all=true
 * GET /api/media?no_universe=true
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const all = searchParams.get("all") === "true";
    const universeId = searchParams.get("universe_id");
    const noUniverse = searchParams.get("no_universe") === "true";

    let query = `
      SELECT m.*,
        (SELECT COUNT(*) FROM seasons s WHERE s.media_id = m.id) as season_count,
        (SELECT MIN(se.start_date) FROM sessions se JOIN seasons s ON se.season_id = s.id WHERE s.media_id = m.id) as first_session_date,
        (SELECT MAX(COALESCE(se.end_date, se.start_date)) FROM sessions se JOIN seasons s ON se.season_id = s.id WHERE s.media_id = m.id) as last_session_date
      FROM media m
      WHERE 1=1
    `;
    const args: (string | number)[] = [];

    if (universeId) {
      query += ` AND m.universe_id = ?`;
      args.push(parseInt(universeId));
    } else if (noUniverse) {
      query += ` AND m.universe_id IS NULL`;
    }

    if (!all && year) {
      query += ` AND EXISTS (
          SELECT 1 FROM sessions se JOIN seasons s ON se.season_id = s.id
          WHERE s.media_id = m.id AND (
            substr(se.start_date,1,4) = ? OR substr(se.end_date,1,4) = ?
          )
        )`;
      args.push(year, year);
    }

    query += ` ORDER BY m.title`;

    const items = sqlite.prepare(query).all(...args) as Record<string, unknown>[];
    const withTags = items.map((item) => ({
      ...item,
      tagList: getMediaTags(item.id as number),
    }));

    return NextResponse.json(withTags);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title, original_title, author, media_type, universe_id,
      cover_url, tmdb_id, ol_key, description, genres, vote_average,
      runtime, release_year, external_synced_at,
      tags: tagsInput, notes, discontinued,
    } = body;

    if (!title || !media_type) {
      return NextResponse.json({ error: "title and media_type are required" }, { status: 400 });
    }

    const r = sqlite.prepare(`
      INSERT INTO media (universe_id, title, original_title, author, media_type, cover_url,
        tmdb_id, ol_key, description, genres, vote_average, runtime, release_year,
        external_synced_at, tags, notes, discontinued)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      universe_id ?? null, title, original_title ?? null, author ?? null, media_type,
      cover_url ?? null, tmdb_id ?? null, ol_key ?? null, description ?? null,
      genres ?? null, vote_average ?? null, runtime ?? null, release_year ?? null,
      external_synced_at ?? null, tagsInput ?? null, notes ?? null,
      discontinued ? 1 : 0,
    );

    const newId = r.lastInsertRowid as number;
    if (tagsInput) setMediaTags(newId, parseTagsInput(tagsInput));

    const created = sqlite.prepare(`SELECT * FROM media WHERE id=?`).get(newId);
    return NextResponse.json({ ...created as object, tagList: getMediaTags(newId) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create media" }, { status: 500 });
  }
}
