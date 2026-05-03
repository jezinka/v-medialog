import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function POST(request: NextRequest) {
  const { ids } = await request.json() as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Wymagane: ids[]" }, { status: 400 });
  }

  const placeholders = ids.map(() => "?").join(",");
  sqlite.prepare(`
    UPDATE vod_notifications SET seen_at=datetime('now') WHERE id IN (${placeholders})
  `).run(...ids);

  return NextResponse.json({ ok: true });
}
