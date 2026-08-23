import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { badRequest, notFound, parseRouteId, serverError } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    const season = sqlite.prepare(`SELECT * FROM seasons WHERE id=?`).get(id);
    if (!season) return notFound();

    const sessions = sqlite.prepare(
      `SELECT * FROM sessions WHERE season_id=? ORDER BY start_date`
    ).all(id);

    return NextResponse.json({ ...season as object, sessions });
  } catch (error) {
    console.error(error);
    return serverError("Failed to fetch season");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    const { season_number, title, cover_url, want_to_watch } = await request.json();
    if (want_to_watch !== undefined && want_to_watch !== true && want_to_watch !== false) {
      return badRequest("want_to_watch must be a boolean");
    }

    sqlite.prepare(
      `UPDATE seasons SET season_number=?, title=?, cover_url=?${want_to_watch !== undefined ? ", want_to_watch=?" : ""} WHERE id=?`
    ).run(
      ...(want_to_watch !== undefined
        ? [season_number ?? null, title ?? null, cover_url ?? null, want_to_watch ? 1 : 0, id]
        : [season_number ?? null, title ?? null, cover_url ?? null, id])
    );

    return NextResponse.json(sqlite.prepare(`SELECT * FROM seasons WHERE id=?`).get(id));
  } catch (error) {
    console.error(error);
    return serverError("Failed to update season");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    sqlite.prepare(`DELETE FROM seasons WHERE id=?`).run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return serverError("Failed to delete season");
  }
}
