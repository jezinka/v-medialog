import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { markWantToWatch } from "@/db/want-to-watch";
import { parseRouteId, jsonError } from "@/lib/api-helpers";
import { CALENDAR_TYPES } from "@/lib/utils";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const mediaId = await parseRouteId(params);
    const media = sqlite.prepare(`SELECT media_type FROM media WHERE id=?`).get(mediaId) as { media_type: string } | undefined;
    if (!media) return jsonError("Media not found", 404);
    // Only these types have a column on the want-to-watch page
    if (!CALENDAR_TYPES.includes(media.media_type)) return jsonError("This media type can't be added to the list", 400);
    const seasonId = sqlite.transaction(() => markWantToWatch(sqlite, mediaId))();
    return NextResponse.json({ seasonId, message: "Dodano do listy" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return jsonError("Failed to mark as want to watch", 500);
  }
}
