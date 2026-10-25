import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { badRequest, notFound, parseRouteId, serverError } from "@/lib/api-helpers";

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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    const { name } = await req.json() as { name?: string };
    if (!name?.trim()) return badRequest("name is required");
    const r = sqlite.prepare(`UPDATE universes SET name=?, updated_at=datetime('now') WHERE id=?`).run(name.trim(), id);
    if (r.changes === 0) return notFound();
    return NextResponse.json(sqlite.prepare(`SELECT * FROM universes WHERE id=?`).get(id));
  } catch (error) {
    console.error(error);
    return serverError("Failed to update universe");
  }
}

/** Deletes the universe; its media stay, just without a universe. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    const removed = sqlite.transaction(() => {
      sqlite.prepare(`UPDATE media SET universe_id=NULL WHERE universe_id=?`).run(id);
      return sqlite.prepare(`DELETE FROM universes WHERE id=?`).run(id).changes;
    })();
    if (removed === 0) return notFound();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return serverError("Failed to delete universe");
  }
}
