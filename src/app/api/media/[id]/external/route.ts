import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

type MediaRow = {
  id: number;
  tmdb_id: number | null;
  ol_key: string | null;
  external_synced_at: string | null;
  description: string | null;
  genres: string | null;
  vote_average: number | null;
  runtime: number | null;
  release_year: number | null;
  series_status: string | null;
  tmdb_seasons_count: number | null;
  track_list: string | null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id);

    const item = sqlite.prepare(`SELECT * FROM media WHERE id=?`).get(numId) as MediaRow | undefined;
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rows = sqlite.prepare(
      `SELECT mp.role, mp.character_name, mp.display_order,
              p.id as person_id, p.name, p.photo_url
       FROM media_persons mp
       JOIN persons p ON mp.person_id = p.id
       WHERE mp.media_id = ?
       ORDER BY mp.display_order`
    ).all(numId) as Array<{ role: string; character_name: string | null; display_order: number; person_id: number; name: string; photo_url: string | null; }>;

    let genres: string[] = [];
    try { genres = item.genres ? JSON.parse(item.genres) : []; } catch { genres = []; }

    return NextResponse.json({
      tmdbId: item.tmdb_id ?? null,
      olKey: item.ol_key ?? null,
      externalSyncedAt: item.external_synced_at ?? null,
      description: item.description ?? null,
      genres,
      voteAverage: item.vote_average ?? null,
      runtime: item.runtime ?? null,
      releaseYear: item.release_year ?? null,
      seriesStatus: item.series_status ?? null,
      tmdbSeasonsCount: item.tmdb_seasons_count ?? null,
      trackList: item.track_list ? (() => { try { return JSON.parse(item.track_list!); } catch { return null; } })() : null,
      persons: rows.map((r) => ({
        personId: r.person_id, name: r.name, photoUrl: r.photo_url,
        role: r.role, characterName: r.character_name, displayOrder: r.display_order,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch external data" }, { status: 500 });
  }
}

type PersonInput = {
  name: string;
  role: string;
  character_name?: string;
  display_order?: number;
  photo_url?: string | null;
  tmdb_id?: number | null;
  ol_author_key?: string | null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id);

    const existing = sqlite.prepare(`SELECT id FROM media WHERE id=?`).get(numId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json() as Record<string, unknown>;
    const { tmdb_id, ol_key, description, genres, vote_average, runtime, release_year, series_status, tmdb_seasons_count, persons: personsInput } = body as {
      tmdb_id?: number | null; ol_key?: string | null; description?: string | null;
      genres?: string[]; vote_average?: number | null; runtime?: number | null;
      release_year?: number | null; series_status?: string | null; tmdb_seasons_count?: number | null;
      persons?: PersonInput[];
    };
    // Only update track_list if explicitly provided in the request body
    const trackListProvided = "track_list" in body;
    const track_list = trackListProvided ? (body.track_list as Array<unknown> | null) : undefined;

    const doSave = sqlite.transaction(() => {
      sqlite.prepare(`
        UPDATE media SET
          tmdb_id=?, ol_key=?, description=?, genres=?,
          vote_average=?, runtime=?, release_year=?,
          series_status=?, tmdb_seasons_count=?,
          ${trackListProvided ? "track_list=?," : ""}
          external_synced_at=datetime('now'), updated_at=datetime('now')
        WHERE id=?
      `).run(...[
        tmdb_id ?? null, ol_key ?? null, description ?? null,
        genres ? JSON.stringify(genres) : null,
        vote_average ?? null, runtime ?? null, release_year ?? null,
        series_status ?? null, tmdb_seasons_count ?? null,
        ...(trackListProvided ? [track_list ? JSON.stringify(track_list) : null] : []),
        numId,
      ]);

      sqlite.prepare(`DELETE FROM media_persons WHERE media_id=?`).run(numId);

      if (Array.isArray(personsInput)) {
        for (const p of personsInput as PersonInput[]) {
          if (!p.name || !p.role) continue;
          let personId: number | null = null;

          if (p.tmdb_id) {
            const found = sqlite.prepare(`SELECT id FROM persons WHERE tmdb_id=?`).get(p.tmdb_id) as { id: number } | undefined;
            if (found) {
              sqlite.prepare(`UPDATE persons SET name=?, photo_url=COALESCE(?,photo_url), ol_author_key=COALESCE(?,ol_author_key) WHERE id=?`)
                .run(p.name, p.photo_url ?? null, p.ol_author_key ?? null, found.id);
              personId = found.id;
            }
          }
          if (!personId) {
            const found = sqlite.prepare(`SELECT id FROM persons WHERE name=?`).get(p.name) as { id: number } | undefined;
            if (found) {
              sqlite.prepare(`UPDATE persons SET photo_url=COALESCE(?,photo_url), tmdb_id=COALESCE(?,tmdb_id), ol_author_key=COALESCE(?,ol_author_key) WHERE id=?`)
                .run(p.photo_url ?? null, p.tmdb_id ?? null, p.ol_author_key ?? null, found.id);
              personId = found.id;
            }
          }
          if (!personId) {
            const result = sqlite.prepare(`INSERT INTO persons (name, photo_url, tmdb_id, ol_author_key) VALUES (?,?,?,?)`)
              .run(p.name, p.photo_url ?? null, p.tmdb_id ?? null, p.ol_author_key ?? null);
            personId = result.lastInsertRowid as number;
          }
          sqlite.prepare(`INSERT INTO media_persons (media_id, person_id, role, character_name, display_order) VALUES (?,?,?,?,?)`)
            .run(numId, personId, p.role, p.character_name ?? null, p.display_order ?? 0);
        }
      }
    });
    doSave();

    const updated = sqlite.prepare(`SELECT * FROM media WHERE id=?`).get(numId) as MediaRow;
    const rows = sqlite.prepare(
      `SELECT mp.role, mp.character_name, mp.display_order, p.id as person_id, p.name, p.photo_url
       FROM media_persons mp JOIN persons p ON mp.person_id=p.id
       WHERE mp.media_id=? ORDER BY mp.display_order`
    ).all(numId) as Array<{ role: string; character_name: string | null; display_order: number; person_id: number; name: string; photo_url: string | null; }>;

    let parsedGenres: string[] = [];
    try { parsedGenres = updated?.genres ? JSON.parse(updated.genres) : []; } catch { parsedGenres = []; }

    return NextResponse.json({
      tmdbId: updated?.tmdb_id ?? null,
      olKey: updated?.ol_key ?? null,
      externalSyncedAt: updated?.external_synced_at ?? null,
      description: updated?.description ?? null,
      genres: parsedGenres,
      voteAverage: updated?.vote_average ?? null,
      runtime: updated?.runtime ?? null,
      releaseYear: updated?.release_year ?? null,
      seriesStatus: updated?.series_status ?? null,
      tmdbSeasonsCount: updated?.tmdb_seasons_count ?? null,
      trackList: updated?.track_list ? (() => { try { return JSON.parse(updated.track_list!); } catch { return null; } })() : null,
      persons: rows.map((r) => ({
        personId: r.person_id, name: r.name, photoUrl: r.photo_url,
        role: r.role, characterName: r.character_name, displayOrder: r.display_order,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save external data" }, { status: 500 });
  }
}
