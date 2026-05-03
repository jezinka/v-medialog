import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { parseTagsInput, setMediaTags } from "@/lib/tags";

interface BulkItem {
  title: string;
  original_title?: string;
  author?: string;
  media_type: string;
  start_date: string;
  end_date?: string;
  season_number?: string | number;
  tags?: string;
  notes?: string;
  discontinued?: boolean | number | string;
  cinema?: boolean | number | string;
  cover_url?: string;
  universe_id?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array required" }, { status: 400 });
    }
    if (items.length > 200) {
      return NextResponse.json({ error: "Max 200 items per bulk insert" }, { status: 400 });
    }

    const results = {
      success: [] as { index: number; media_id: number; season_id: number; session_id: number; title: string }[],
      failed: [] as { index: number; title: string; error: string }[],
      total: items.length,
    };

    const insertFn = sqlite.transaction(() => {
      items.forEach((item: BulkItem, index: number) => {
        try {
          const { title, original_title, author, media_type, start_date, end_date,
            season_number, tags: tagsInput, notes, discontinued, cinema, cover_url, universe_id } = item;

          if (!title || !media_type || !start_date) throw new Error("title, media_type, start_date required");

          const discNum = discontinued === true || discontinued === 1 || discontinued === "1" ? 1 : 0;
          const cinNum = cinema === true || cinema === 1 || cinema === "1" ? 1 : 0;

          const mediaRes = sqlite.prepare(`
            INSERT INTO media (universe_id, title, original_title, author, media_type, cover_url, tags, notes, discontinued)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(universe_id ?? null, title, original_title ?? null, author ?? null, media_type, cover_url ?? null, tagsInput ?? null, notes ?? null, discNum);

          const mediaId = mediaRes.lastInsertRowid as number;
          if (tagsInput) setMediaTags(mediaId, parseTagsInput(tagsInput));

          const sn = season_number != null ? parseInt(String(season_number), 10) : null;
          const seasonRes = sqlite.prepare(
            `INSERT INTO seasons (media_id, season_number) VALUES (?, ?)`
          ).run(mediaId, isNaN(sn as number) ? null : sn);
          const seasonId = seasonRes.lastInsertRowid as number;

          const sessionRes = sqlite.prepare(
            `INSERT INTO sessions (season_id, start_date, end_date, cinema) VALUES (?, ?, ?, ?)`
          ).run(seasonId, start_date, end_date ?? null, cinNum);
          const sessionId = sessionRes.lastInsertRowid as number;

          results.success.push({ index, media_id: mediaId, season_id: seasonId, session_id: sessionId, title });
        } catch (e) {
          results.failed.push({ index, title: (item as BulkItem).title || "unknown", error: (e as Error).message });
        }
      });
    });

    insertFn();

    const status = results.failed.length === 0 ? 201 : 207;
    return NextResponse.json({
      message: `Bulk insert: ${results.success.length}/${results.total} ok`,
      results,
    }, { status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Bulk insert failed" }, { status: 500 });
  }
}
