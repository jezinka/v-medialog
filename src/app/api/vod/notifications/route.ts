import { NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function GET() {
  const notifications = sqlite.prepare(`
    SELECT * FROM vod_notifications
    WHERE seen_at IS NULL
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  return NextResponse.json(notifications);
}
