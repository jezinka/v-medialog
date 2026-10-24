import { NextRequest, NextResponse } from "next/server";
import { refreshVodOffers } from "@/lib/vod";

export async function POST(request: NextRequest) {
  try {
    const { itemId, title, year, tmdbId, mediaType } = await request.json() as {
      itemId: number;
      title: string;
      year?: number | null;
      tmdbId?: number | null;
      mediaType?: string;
    };

    if (!itemId || !title) {
      return NextResponse.json({ error: "Wymagane: itemId, title" }, { status: 400 });
    }

    await refreshVodOffers({ id: itemId, title, year, tmdbId, mediaType });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[vod/check]", err);
    return NextResponse.json({ error: "Błąd sprawdzania VOD" }, { status: 500 });
  }
}
