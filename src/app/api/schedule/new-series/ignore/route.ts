import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { badRequest, serverError } from "@/lib/api-helpers";
import { parseTmdbId } from "@/lib/new-series";

/** POST /api/schedule/new-series/ignore { tmdb_id } — hides the show from the new series list */
export async function POST(request: NextRequest) {
  const tmdbId = parseTmdbId(await request.json().catch(() => null));
  if (!tmdbId) return badRequest("tmdb_id must be a positive integer");
  try {
    sqlite.prepare(`INSERT OR IGNORE INTO ignored_new_series (tmdb_id) VALUES (?)`).run(tmdbId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return serverError("Failed to hide series");
  }
}

/** DELETE /api/schedule/new-series/ignore { tmdb_id } — shows the show again */
export async function DELETE(request: NextRequest) {
  const tmdbId = parseTmdbId(await request.json().catch(() => null));
  if (!tmdbId) return badRequest("tmdb_id must be a positive integer");
  try {
    sqlite.prepare(`DELETE FROM ignored_new_series WHERE tmdb_id=?`).run(tmdbId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return serverError("Failed to restore series");
  }
}
