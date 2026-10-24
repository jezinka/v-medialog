import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { notFound, parseRouteId, serverError } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    const universe = sqlite.prepare(`SELECT * FROM universes WHERE id=?`).get(id);
    if (!universe) return notFound();

    const media = sqlite.prepare(
      `SELECT m.id, m.title, m.original_title, m.media_type, m.cover_url, m.release_year, m.discontinued,
              MIN(s.start_date) as first_seen
       FROM media m
       LEFT JOIN seasons se ON se.media_id = m.id
       LEFT JOIN sessions s ON s.season_id = se.id
       WHERE m.universe_id=?
       GROUP BY m.id, m.title, m.original_title, m.media_type, m.cover_url, m.release_year, m.discontinued
       ORDER BY COALESCE(m.release_year, CAST(strftime('%Y', MIN(s.start_date)) AS INTEGER), 9999), m.title`
    ).all(id);

    return NextResponse.json({ ...universe as object, media });
  } catch (error) {
    console.error(error);
    return serverError("Failed to fetch universe");
  }
}
