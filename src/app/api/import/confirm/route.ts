import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { parseTagsInput, setMediaTags } from "@/lib/tags";

interface MediaItem {
  title: string;
  original_title?: string;
  author?: string;
  media_type: string;
  start_date: string;
  end_date?: string;
  season_number?: string | number;
  tags?: string;
  notes?: string;
  discontinued?: string | number | boolean;
  cinema?: string | number | boolean;
  cover_url?: string;
  // Legacy field from old exports — extra sessions become additional session rows
  additional_sessions?: string;
}

interface WishlistItem {
  title: string;
  author?: string;
  media_type: string;
  priority?: string;
  notes?: string;
  cover_url?: string;
}

type ParsedItem = MediaItem | WishlistItem;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, type } = body as { items: ParsedItem[]; type: "media" | "wishlist" };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Brak pozycji do importu" }, { status: 400 });
    }

    let inserted = 0;
    let failed = 0;

    const insertAll = sqlite.transaction(() => {
      if (type === "media") {
        for (const item of items as MediaItem[]) {
          try {
            const disc = item.discontinued;
            const discNum = disc === true || disc === 1 || disc === "1" ? 1 : 0;
            const cin = item.cinema;
            const cinNum = cin === true || cin === 1 || cin === "1" ? 1 : 0;
            const sn = item.season_number != null ? parseInt(String(item.season_number), 10) : null;

            const mediaRes = sqlite.prepare(`
              INSERT INTO media (title, original_title, author, media_type, cover_url, tags, notes, discontinued)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              item.title, item.original_title ?? null, item.author ?? null, item.media_type,
              item.cover_url ?? null, item.tags ?? null, item.notes ?? null, discNum
            );
            const mediaId = mediaRes.lastInsertRowid as number;
            if (item.tags) setMediaTags(mediaId, parseTagsInput(item.tags));

            const seasonRes = sqlite.prepare(
              `INSERT INTO seasons (media_id, season_number) VALUES (?, ?)`
            ).run(mediaId, !sn || isNaN(sn) ? null : sn);
            const seasonId = seasonRes.lastInsertRowid as number;

            sqlite.prepare(
              `INSERT INTO sessions (season_id, start_date, end_date, cinema) VALUES (?, ?, ?, ?)`
            ).run(seasonId, item.start_date, item.end_date ?? null, cinNum);

            // Handle legacy additional_sessions JSON
            if (item.additional_sessions) {
              try {
                const extra = JSON.parse(item.additional_sessions) as Array<{ start_date: string; end_date?: string }>;
                for (const s of extra) {
                  if (!s.start_date) continue;
                  sqlite.prepare(
                    `INSERT INTO sessions (season_id, start_date, end_date, cinema) VALUES (?, ?, ?, ?)`
                  ).run(seasonId, s.start_date, s.end_date ?? null, cinNum);
                }
              } catch { /* ignore malformed JSON */ }
            }

            inserted++;
          } catch {
            failed++;
          }
        }
      } else {
        const stmt = sqlite.prepare(
          `INSERT INTO wishlist (title, author, media_type, priority, notes, cover_url) VALUES (?, ?, ?, ?, ?, ?)`
        );
        for (const item of items as WishlistItem[]) {
          try {
            stmt.run(item.title, item.author ?? null, item.media_type, item.priority ?? "normal", item.notes ?? null, item.cover_url ?? null);
            inserted++;
          } catch { failed++; }
        }
      }
    });

    insertAll();

    return NextResponse.json({
      inserted, failed,
      message: `Zaimportowano ${inserted} pozycji${failed > 0 ? `, ${failed} błędów` : ""}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Import nie powiódł się" }, { status: 500 });
  }
}
