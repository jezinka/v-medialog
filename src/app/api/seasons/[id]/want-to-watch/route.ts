import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { parseRouteId, jsonError } from "@/lib/api-helpers";

/**
 * Removes a season from the want-to-watch list. Its sessions are only premiere markers,
 * so they go too (left unflagged they would count as watches); a season left with
 * nothing of its own (no title, no cover) is deleted.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const seasonId = await parseRouteId(params);
    const season = sqlite.prepare(`SELECT want_to_watch, title, cover_url FROM seasons WHERE id=?`).get(seasonId) as
      { want_to_watch: number; title: string | null; cover_url: string | null } | undefined;
    if (!season) return jsonError("Season not found", 404);
    if (season.want_to_watch !== 1) return jsonError("Season is not on the want-to-watch list", 400);

    const deleted = !season.title && !season.cover_url;
    sqlite.transaction(() => {
      sqlite.prepare(`DELETE FROM sessions WHERE season_id=?`).run(seasonId);
      if (deleted) sqlite.prepare(`DELETE FROM seasons WHERE id=?`).run(seasonId);
      else sqlite.prepare(`UPDATE seasons SET want_to_watch=0 WHERE id=?`).run(seasonId);
    })();

    return NextResponse.json({ deleted });
  } catch (error) {
    console.error(error);
    return jsonError("Failed to remove from want-to-watch list", 500);
  }
}
