import { NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function POST() {
  try {
    sqlite.pragma("foreign_keys = ON");

    const ytMediaIds = (sqlite.prepare(
      `SELECT id FROM media WHERE media_type = 'yt'`
    ).all() as { id: number }[]).map((r) => r.id);

    let deletedMedia = 0;
    if (ytMediaIds.length > 0) {
      const placeholders = ytMediaIds.map(() => "?").join(",");
      sqlite.prepare(`DELETE FROM media WHERE id IN (${placeholders})`).run(...ytMediaIds);
      deletedMedia = ytMediaIds.length;
    }

    // Remove persons that have no remaining media links
    sqlite.exec(`
      DELETE FROM persons
      WHERE id NOT IN (SELECT DISTINCT person_id FROM media_persons)
    `);

    // Remove yt_history if table exists
    try {
      const { count } = sqlite.prepare(`SELECT COUNT(*) as count FROM yt_history`).get() as { count: number };
      sqlite.exec(`DELETE FROM yt_history`);
      return NextResponse.json({ ok: true, deletedMedia, deletedHistory: count });
    } catch {
      // Table doesn't exist — that's fine
    }

    return NextResponse.json({ ok: true, deletedMedia, deletedHistory: 0 });
  } catch (error) {
    console.error("YT cleanup error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
