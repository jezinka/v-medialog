import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { parseRouteId, jsonError } from "@/lib/api-helpers";

/** "Zaczynam" for a want-to-watch season: its sessions are only premiere markers, so replace them with today's session. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const seasonId = await parseRouteId(params);
    const season = sqlite.prepare(`SELECT want_to_watch FROM seasons WHERE id=?`).get(seasonId) as { want_to_watch: number } | undefined;
    if (!season) return jsonError("Season not found", 404);
    if (season.want_to_watch !== 1) return jsonError("Season is not on the want-to-watch list", 400);

    const today = new Date().toISOString().split("T")[0];
    sqlite.transaction(() => {
      sqlite.prepare(`DELETE FROM sessions WHERE season_id=?`).run(seasonId);
      sqlite.prepare(`INSERT INTO sessions (season_id, start_date) VALUES (?, ?)`).run(seasonId, today);
      sqlite.prepare(`UPDATE seasons SET want_to_watch=0 WHERE id=?`).run(seasonId);
    })();

    return NextResponse.json({ message: "Przeniesiono do dziennika" });
  } catch (error) {
    console.error(error);
    return jsonError("Failed to start season", 500);
  }
}
