import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { parseTagsInput, setMediaTags } from "@/lib/tags";
import { markWantToWatch } from "@/db/want-to-watch";
import { removeRedundantPlaceholders } from "@/db/placeholders";

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
  release_year?: string | number;
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
              `INSERT INTO seasons (media_id, season_number, want_to_watch) VALUES (?, ?, 0)`
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
            removeRedundantPlaceholders(sqlite, seasonId);

            inserted++;
          } catch {
            failed++;
          }
        }
      } else {
        const findMedia = sqlite.prepare(`SELECT id FROM media WHERE title=? AND media_type=? AND release_year IS ?`);
        const stmt = sqlite.prepare(
          `INSERT INTO media (title, author, media_type, notes, cover_url, release_year, discontinued) VALUES (?, ?, ?, ?, ?, ?, 0)`
        );
        for (const item of items as WishlistItem[]) {
          try {
            const year = item.release_year ? Number(item.release_year) : null;
            const releaseYear = Number.isInteger(year) ? year : null;
            // Reuse media only on an unambiguous title + type + year match, otherwise create new
            const matches = findMedia.all(item.title, item.media_type, releaseYear) as { id: number }[];
            const mediaId = matches.length === 1
              ? matches[0].id
              : Number(stmt.run(item.title, item.author ?? null, item.media_type, item.notes ?? null, item.cover_url ?? null, releaseYear).lastInsertRowid);
            markWantToWatch(sqlite, mediaId);
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
