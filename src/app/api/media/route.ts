import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { parseTagsInput, setMediaTags, getMediaTags } from "@/lib/tags";

/**
 * GET /api/media?year=2025
 * GET /api/media?universe_id=3
 * GET /api/media?all=true
 * GET /api/media?no_universe=true
 * GET /api/media?page=1&limit=50&search=...&type=...&noCover=1&ongoing=1&behind=1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const all = searchParams.get("all") === "true";
    const universeId = searchParams.get("universe_id");
    const noUniverse = searchParams.get("no_universe") === "true";

    // Pagination & filtering params
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const offset = (page - 1) * limit;
    const search = searchParams.get("search")?.trim();
    const type = searchParams.get("type")?.trim();
    const noCover = searchParams.get("noCover") === "1";
    const ongoing = searchParams.get("ongoing") === "1";
    const behind = searchParams.get("behind") === "1";
    const sortBy = searchParams.get("sortBy") === "recently_added" ? "recently_added" : "title";
    const paginate = !all && !universeId && !noUniverse && !year;

    const clauses: string[] = [];
    const args: (string | number)[] = [];

    if (universeId) {
      clauses.push(`m.universe_id = ?`);
      args.push(parseInt(universeId));
    } else if (noUniverse) {
      clauses.push(`m.universe_id IS NULL`);
    }

    if (!all && year) {
      clauses.push(`EXISTS (
          SELECT 1 FROM sessions se JOIN seasons s ON se.season_id = s.id
          WHERE s.media_id = m.id AND (
            substr(se.start_date,1,4) = ? OR substr(se.end_date,1,4) = ?
          )
        )`);
      args.push(year, year);
    }

    if (paginate) {
      if (search) {
        clauses.push(`(m.title LIKE ? OR m.original_title LIKE ? OR m.author LIKE ?)`);
        args.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (type && type !== "all") {
        clauses.push(`m.media_type = ?`);
        args.push(type);
      }
      if (noCover) {
        clauses.push(`m.cover_url IS NULL`);
      }
      if (ongoing) {
        clauses.push(`m.media_type IN ('series','anime','cartoon')`);
        clauses.push(`m.series_status NOT IN ('Ended','Canceled','Cancelled')`);
      }
      if (behind) {
        clauses.push(`m.media_type IN ('series','anime','cartoon')`);
        clauses.push(`m.tmdb_seasons_count IS NOT NULL`);
        clauses.push(`(SELECT COUNT(*) FROM seasons s WHERE s.media_id = m.id) < m.tmdb_seasons_count`);
      }
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const baseSelect = `
      SELECT m.*,
        (SELECT COUNT(*) FROM seasons s WHERE s.media_id = m.id) as season_count,
        (SELECT MIN(se.start_date) FROM sessions se JOIN seasons s ON se.season_id = s.id WHERE s.media_id = m.id) as first_session_date,
        (SELECT MAX(COALESCE(se.end_date, se.start_date)) FROM sessions se JOIN seasons s ON se.season_id = s.id WHERE s.media_id = m.id) as last_session_date
      FROM media m
      ${whereSql}
    `;

    if (paginate) {
      const totalRow = sqlite.prepare(`SELECT COUNT(*) as count FROM media m ${whereSql}`).get(...args) as { count: number };
      const orderSql = sortBy === "recently_added" ? "m.created_at DESC, m.id DESC" : "m.title";
      const items = sqlite.prepare(`${baseSelect} ORDER BY ${orderSql} LIMIT ? OFFSET ?`).all(...args, limit, offset) as Record<string, unknown>[];
      const withTags = items.map((item) => ({ ...item, tagList: getMediaTags(item.id as number) }));
      return NextResponse.json({ items: withTags, total: totalRow.count, page, limit });
    }

    const items = sqlite.prepare(`${baseSelect} ORDER BY m.title`).all(...args) as Record<string, unknown>[];
    const withTags = items.map((item) => ({ ...item, tagList: getMediaTags(item.id as number) }));
    (withTags as unknown as { title?: string }[]).sort((a, b) =>
      (a.title ?? "").localeCompare(b.title ?? "", "pl", { sensitivity: "base" })
    );
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
      tags: tagsInput, notes, discontinued, source_url,
    } = body;

    if (!title || !media_type) {
      return NextResponse.json({ error: "title and media_type are required" }, { status: 400 });
    }

    const r = sqlite.prepare(`
      INSERT INTO media (universe_id, title, original_title, author, media_type, cover_url,
        tmdb_id, ol_key, description, genres, vote_average, runtime, release_year,
        external_synced_at, tags, notes, discontinued, source_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      universe_id ?? null, title, original_title ?? null, author ?? null, media_type,
      cover_url ?? null, tmdb_id ?? null, ol_key ?? null, description ?? null,
      genres ?? null, vote_average ?? null, runtime ?? null, release_year ?? null,
      external_synced_at ?? null, tagsInput ?? null, notes ?? null,
      discontinued ? 1 : 0, source_url ?? null,
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
