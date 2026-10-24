import { NextResponse } from "next/server";
import { sqlite } from "@/db";
import { serviceName } from "@/lib/vod";

export async function GET() {
  const notifications = sqlite.prepare(`
    SELECT * FROM vod_notifications
    WHERE seen_at IS NULL
    ORDER BY created_at DESC
    LIMIT 100
  `).all() as { provider_name: string }[];

  // Older notifications were stored under Amazon channel names
  return NextResponse.json(notifications.map((n) => ({ ...n, provider_name: serviceName(n.provider_name) })));
}
