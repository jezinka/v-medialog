import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * POST /api/media/merge
 * Body: { target_media_id: number, source_ids: number[] }
 *
 * Dla każdego source_id:
 *   1. Pobiera tytuł i numer tomu (season_number) z istniejącego sezonu
 *   2. Tworzy nowy sezon pod target_media_id
 *   3. Przenosi sesje do nowego sezonu
 *   4. Usuwa stare sezony i stare medium
 */
export async function POST(request: NextRequest) {
  try {
    const { target_media_id, source_ids } = await request.json() as {
      target_media_id: number;
      source_ids: number[];
    };

    if (!target_media_id || !Array.isArray(source_ids) || source_ids.length === 0) {
      return NextResponse.json({ error: "target_media_id and source_ids required" }, { status: 400 });
    }

    const merge = sqlite.transaction(() => {
      let merged = 0;

      for (const sourceId of source_ids) {
        if (sourceId === target_media_id) continue;

        const sourceMedia = sqlite.prepare(`SELECT * FROM media WHERE id=?`).get(sourceId) as {
          id: number; title: string; original_title: string | null; cover_url: string | null;
        } | undefined;
        if (!sourceMedia) continue;

        // Pobierz wszystkie sezony source
        const sourceSeasons = sqlite.prepare(`SELECT * FROM seasons WHERE media_id=?`).all(sourceId) as {
          id: number; season_number: number | null; title: string | null; cover_url: string | null;
        }[];

        for (const srcSeason of sourceSeasons) {
          // Utwórz nowy sezon pod target — tytuł = tytuł medium jeśli nie ma tytułu sezonu
          const seasonTitle = srcSeason.title ?? sourceMedia.original_title ?? sourceMedia.title;
          // Okładka sezonu lub fallback na okładkę medium
          const seasonCover = srcSeason.cover_url ?? sourceMedia.cover_url;
          const newSeason = sqlite.prepare(`
            INSERT INTO seasons (media_id, season_number, title, cover_url)
            VALUES (?, ?, ?, ?)
          `).run(target_media_id, srcSeason.season_number, seasonTitle, seasonCover);

          const newSeasonId = newSeason.lastInsertRowid;

          // Przenieś sesje
          sqlite.prepare(`UPDATE sessions SET season_id=? WHERE season_id=?`)
            .run(newSeasonId, srcSeason.id);

          // Usuń stary sezon
          sqlite.prepare(`DELETE FROM seasons WHERE id=?`).run(srcSeason.id);
        }

        // Przenieś powiązania osób
        sqlite.prepare(`
          UPDATE media_persons SET media_id=?
          WHERE media_id=?
          AND NOT EXISTS (SELECT 1 FROM media_persons mp2 WHERE mp2.media_id=? AND mp2.person_id=media_persons.person_id)
        `).run(target_media_id, sourceId, target_media_id);
        sqlite.prepare(`DELETE FROM media_persons WHERE media_id=?`).run(sourceId);

        // Usuń stare medium
        sqlite.prepare(`DELETE FROM media WHERE id=?`).run(sourceId);
        merged++;
      }

      return merged;
    });

    const count = merge();
    return NextResponse.json({ merged: count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Merge failed" }, { status: 500 });
  }
}
