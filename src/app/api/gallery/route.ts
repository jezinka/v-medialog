import { NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * GET /api/gallery
 * Returns one row per season that has at least one session.
 * cover_url = season's own cover if set, else media cover (fallback).
 * Sorted by first_session_date DESC.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");

  try {
    const whereYear = year
      ? `WHERE se.start_date LIKE '${year}-%'`
      : "";

    const rows = sqlite.prepare(`
      SELECT
        sn.id                   AS season_id,
        m.id                    AS media_id,
        m.title                 AS media_title,
        m.media_type,
        m.volume_episode,
        sn.title                AS season_title,
        sn.season_number,
        COALESCE(sn.cover_url, m.cover_url) AS cover_url,
        sn.cover_url            AS season_cover_url,
        m.cover_url             AS media_cover_url,
        MIN(se.start_date)      AS first_session_date,
        MAX(COALESCE(se.end_date, se.start_date)) AS last_session_date,
        COUNT(se.id)            AS session_count
      FROM seasons sn
      JOIN media m ON sn.media_id = m.id
      JOIN sessions se ON se.season_id = sn.id
      ${whereYear}
      GROUP BY sn.id
      ORDER BY first_session_date DESC
    `).all() as {
      season_id: number;
      media_id: number;
      media_title: string;
      media_type: string;
      volume_episode: string | null;
      season_title: string | null;
      season_number: number | null;
      cover_url: string | null;
      season_cover_url: string | null;
      media_cover_url: string | null;
      first_session_date: string;
      last_session_date: string;
      session_count: number;
    }[];

    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch gallery" }, { status: 500 });
  }
}
