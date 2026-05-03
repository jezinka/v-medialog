import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { SCREEN_TYPES, ITUNES_TYPES } from "@/lib/utils";

const DB_PATH = process.env.DATABASE_URL ?? join(process.cwd(), "medialog.db");
const COVERS_DIR = join(dirname(DB_PATH), "covers");

export type TmdbCandidate = {
  tmdb_id: number;
  name: string;
  first_air_date: string;
  poster_path: string | null;
};

export type ItunesCandidate = {
  itunes_id: number;
  title: string;
  artist: string;
  year: number | null;
  cover_url: string | null;
};

export type SyncedItem = { id: number; title: string; media_type: string };
export type FailedItem = { id: number; title: string; media_type: string; error: string };
export type NeedsReviewItem = {
  id: number;
  title: string;
  media_type: string;
  source: "tmdb" | "itunes";
  candidates: TmdbCandidate[] | ItunesCandidate[];
};

type MediaRow = {
  id: number;
  title: string;
  original_title: string | null;
  author: string | null;
  media_type: string;
  external_synced_at: string | null;
  tmdb_id: number | null;
  ol_key: string | null;
};

type PersonInput = {
  name: string;
  role: string;
  character_name?: string;
  display_order?: number;
  photo_url?: string | null;
  tmdb_id?: number | null;
};

async function downloadCover(url: string): Promise<string | null> {
  if (!url?.startsWith("http")) return null;
  try {
    if (!existsSync(COVERS_DIR)) mkdirSync(COVERS_DIR, { recursive: true });
    const ext = url.includes(".png") ? ".png" : url.includes(".webp") ? ".webp" : ".jpg";
    const filename = createHash("md5").update(url).digest("hex") + ext;
    const filepath = join(COVERS_DIR, filename);
    if (!existsSync(filepath)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(filepath, buffer);
    }
    return `/api/covers/${filename}`;
  } catch {
    return null;
  }
}

function saveExternalToDb(
  mediaId: number,
  data: {
    tmdb_id?: number | null;
    ol_key?: string | null;
    description?: string | null;
    genres?: string[];
    vote_average?: number | null;
    runtime?: number | null;
    release_year?: number | null;
    series_status?: string | null;
    tmdb_seasons_count?: number | null;
    track_list?: unknown[] | null;
    persons?: PersonInput[];
  }
) {
  const doSave = sqlite.transaction(() => {
    sqlite.prepare(`
      UPDATE media SET
        tmdb_id=?, ol_key=?, description=?, genres=?,
        vote_average=?, runtime=?, release_year=?,
        series_status=?, tmdb_seasons_count=?, track_list=?,
        external_synced_at=datetime('now'), updated_at=datetime('now')
      WHERE id=?
    `).run(
      data.tmdb_id ?? null,
      data.ol_key ?? null,
      data.description ?? null,
      data.genres ? JSON.stringify(data.genres) : null,
      data.vote_average ?? null,
      data.runtime ?? null,
      data.release_year ?? null,
      data.series_status ?? null,
      data.tmdb_seasons_count ?? null,
      data.track_list ? JSON.stringify(data.track_list) : null,
      mediaId
    );

    sqlite.prepare(`DELETE FROM media_persons WHERE media_id=?`).run(mediaId);

    for (const p of (data.persons ?? [])) {
      if (!p.name || !p.role) continue;
      let personId: number | null = null;

      if (p.tmdb_id) {
        const found = sqlite.prepare(`SELECT id FROM persons WHERE tmdb_id=?`).get(p.tmdb_id) as { id: number } | undefined;
        if (found) {
          sqlite.prepare(`UPDATE persons SET name=?, photo_url=COALESCE(?,photo_url) WHERE id=?`)
            .run(p.name, p.photo_url ?? null, found.id);
          personId = found.id;
        }
      }
      if (!personId) {
        const found = sqlite.prepare(`SELECT id FROM persons WHERE name=?`).get(p.name) as { id: number } | undefined;
        if (found) {
          sqlite.prepare(`UPDATE persons SET photo_url=COALESCE(?,photo_url), tmdb_id=COALESCE(?,tmdb_id) WHERE id=?`)
            .run(p.photo_url ?? null, p.tmdb_id ?? null, found.id);
          personId = found.id;
        }
      }
      if (!personId) {
        const result = sqlite.prepare(`INSERT INTO persons (name, photo_url, tmdb_id) VALUES (?,?,?)`)
          .run(p.name, p.photo_url ?? null, p.tmdb_id ?? null);
        personId = result.lastInsertRowid as number;
      }
      sqlite.prepare(`INSERT INTO media_persons (media_id, person_id, role, character_name, display_order) VALUES (?,?,?,?,?)`)
        .run(mediaId, personId, p.role, p.character_name ?? null, p.display_order ?? 0);
    }
  });
  doSave();
}

async function updateCoverUrl(mediaId: number, coverUrl: string) {
  const media = sqlite.prepare(`SELECT title, original_title, author, media_type, notes, tags, discontinued, tmdb_id, ol_key FROM media WHERE id=?`).get(mediaId) as Record<string, unknown> | undefined;
  if (!media) return;
  sqlite.prepare(`UPDATE media SET cover_url=?, updated_at=datetime('now') WHERE id=?`).run(coverUrl, mediaId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTmdbPersons(d: any, isTv: boolean): PersonInput[] {
  const persons: PersonInput[] = [];
  const cast = (d.credits?.cast ?? []) as Array<{ id?: number; name: string; character: string; profile_path?: string | null }>;
  persons.push(...cast.slice(0, 12).map((c, i) => ({
    name: c.name,
    role: "actor",
    character_name: c.character,
    display_order: i,
    photo_url: c.profile_path ? `https://image.tmdb.org/t/p/w45${c.profile_path}` : null,
    tmdb_id: c.id ?? null,
  })));
  if (!isTv) {
    const director = (d.credits?.crew ?? []).find((c: { name: string; job: string }) => c.job === "Director");
    if (director) persons.push({ name: director.name, role: "director", display_order: 0 });
  } else {
    const createdBy = (d.created_by ?? []) as Array<{ name: string }>;
    persons.push(...createdBy.map((c, i) => ({ name: c.name, role: "creator", display_order: i })));
  }
  return persons;
}

async function syncTmdb(media: MediaRow, apiKey: string): Promise<{ ok: true; coverUrl: string | null } | { candidates: TmdbCandidate[] } | { error: string }> {
  const isTv = media.media_type === "series" || media.media_type === "anime";
  let tmdbId = media.tmdb_id;

  if (!tmdbId) {
    const searchQuery = media.original_title || media.title;
    const searchType = isTv ? "tv" : "movie";
    const searchUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}&language=pl-PL`;
    const searchRes = await fetch(searchUrl, { cache: "no-store" });
    const searchData = await searchRes.json();
    const results = (searchData.results ?? []) as Array<{ id: number; name?: string; title?: string; first_air_date?: string; release_date?: string; poster_path?: string | null }>;

    if (results.length === 0) return { error: `Nie znaleziono "${searchQuery}"` };
    if (results.length > 1) {
      return {
        candidates: results.slice(0, 5).map((r) => ({
          tmdb_id: r.id,
          name: r.name ?? r.title ?? "",
          first_air_date: r.first_air_date ?? r.release_date ?? "",
          poster_path: r.poster_path ? `https://image.tmdb.org/t/p/w92${r.poster_path}` : null,
        })),
      };
    }
    tmdbId = results[0].id;
  }

  const endpoint = isTv
    ? `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}&language=pl-PL&append_to_response=credits`
    : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=pl-PL&append_to_response=credits`;

  const detailRes = await fetch(endpoint, { cache: "no-store" });
  if (!detailRes.ok) return { error: "Błąd pobierania szczegółów z TMDB" };

  const d = await detailRes.json();
  const dateStr = isTv ? (d.first_air_date as string | undefined) : (d.release_date as string | undefined);
  const releaseYear = dateStr ? parseInt(dateStr.slice(0, 4)) || null : null;
  const posterUrl = d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : null;
  const genres = ((d.genres ?? []) as Array<{ name: string }>).map((g) => g.name);

  saveExternalToDb(media.id, {
    tmdb_id: tmdbId,
    description: d.overview ?? null,
    genres,
    vote_average: d.vote_average ?? null,
    runtime: isTv ? null : (d.runtime ?? null),
    release_year: releaseYear,
    series_status: isTv ? (d.status ?? null) : null,
    tmdb_seasons_count: isTv ? (d.number_of_seasons ?? null) : null,
    persons: buildTmdbPersons(d, isTv),
  });

  let savedCoverPath: string | null = null;
  if (posterUrl) {
    savedCoverPath = await downloadCover(posterUrl);
    if (savedCoverPath) await updateCoverUrl(media.id, savedCoverPath);
  }

  return { ok: true, coverUrl: savedCoverPath };
}

function hiResCover(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace("100x100bb", "600x600bb");
}

async function syncItunes(media: MediaRow): Promise<{ ok: true; coverUrl: string | null } | { candidates: ItunesCandidate[] } | { error: string }> {
  const type = media.media_type;
  const entity = type === "podcast" ? "podcast" : "album";
  const mediaType = type === "podcast" ? "podcast" : "music";

  const title = media.original_title ?? media.title;
  const term = media.author ? `${title} ${media.author}` : title;
  const params = new URLSearchParams({ term, entity, media: mediaType, limit: "8", country: "PL" });

  interface ItunesApiResult {
    trackId?: number;
    collectionId?: number;
    trackName?: string;
    collectionName?: string;
    artistName?: string;
    artworkUrl100?: string;
    primaryGenreName?: string;
    genres?: string[];
    releaseDate?: string;
    trackCount?: number;
    trackNumber?: number;
    trackTimeMillis?: number;
    description?: string;
    longDescription?: string;
    wrapperType?: string;
  }

  let results: ItunesApiResult[] = [];
  const res = await fetch(`https://itunes.apple.com/search?${params}`, { cache: "no-store" });
  if (res.ok) {
    const data = await res.json() as { resultCount: number; results: ItunesApiResult[] };
    results = data.results ?? [];
    if (results.length === 0) {
      // retry without country
      const res2 = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&media=${mediaType}&limit=8`, { cache: "no-store" });
      if (res2.ok) {
        const data2 = await res2.json() as { results: ItunesApiResult[] };
        results = data2.results ?? [];
      }
    }
  }

  if (results.length === 0) return { error: `Nie znaleziono "${term}"` };

  if (results.length > 1) {
    return {
      candidates: results.slice(0, 6).map((item) => ({
        itunes_id: item.collectionId ?? item.trackId ?? 0,
        title: item.collectionName ?? item.trackName ?? "",
        artist: item.artistName ?? "",
        year: item.releaseDate ? parseInt(item.releaseDate.slice(0, 4)) || null : null,
        cover_url: hiResCover(item.artworkUrl100),
      })),
    };
  }

  const item = results[0];
  const collectionId = item.collectionId ?? item.trackId ?? 0;
  const coverUrl = hiResCover(item.artworkUrl100);
  const genres: string[] = (item.genres ?? (item.primaryGenreName ? [item.primaryGenreName] : [])).filter((g: string) => g !== "Music" && g !== "Podcast");

  // Fetch tracks for records
  let trackList: Array<{ number: number; title: string; duration_ms: number | null }> | null = null;
  if (type === "record" && collectionId) {
    try {
      const tracksRes = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=song&country=PL`, { cache: "no-store" });
      if (tracksRes.ok) {
        const tracksData = await tracksRes.json() as { results: ItunesApiResult[] };
        const songs = tracksData.results.filter((r) => r.wrapperType === "track" && r.trackName);
        if (songs.length > 0) {
          trackList = songs
            .sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0))
            .map((s) => ({ number: s.trackNumber ?? 0, title: s.trackName ?? "", duration_ms: s.trackTimeMillis ?? null }));
        }
      }
    } catch { /* ignore */ }
  }

  saveExternalToDb(media.id, {
    ol_key: `itunes:${collectionId}`,
    description: item.longDescription ?? item.description ?? null,
    genres,
    release_year: item.releaseDate ? parseInt(item.releaseDate.slice(0, 4)) || null : null,
    track_list: trackList,
    persons: media.author ? [{ name: media.author, role: "author", display_order: 0 }] : [],
  });

  let savedCoverPath: string | null = null;
  if (coverUrl) {
    savedCoverPath = await downloadCover(coverUrl);
    if (savedCoverPath) await updateCoverUrl(media.id, savedCoverPath);
  }
  return { ok: true, coverUrl: savedCoverPath };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { skip_synced?: boolean; media_ids?: number[] };
    const skipSynced = body.skip_synced !== false; // default: skip already synced
    const mediaIds = body.media_ids;

    const tmdbApiKey = process.env.TMDB_API_KEY;

    let query = `SELECT id, title, original_title, author, media_type, external_synced_at, tmdb_id, ol_key FROM media`;
    const args: (string | number)[] = [];

    if (mediaIds?.length) {
      query += ` WHERE id IN (${mediaIds.map(() => "?").join(",")})`;
      args.push(...mediaIds);
    } else if (skipSynced) {
      query += ` WHERE external_synced_at IS NULL`;
    }
    query += ` ORDER BY title`;

    const items = sqlite.prepare(query).all(...args) as MediaRow[];

    const synced: SyncedItem[] = [];
    const failed: FailedItem[] = [];
    const needsReview: NeedsReviewItem[] = [];

    for (const media of items) {
      try {
        let result: { ok: true; coverUrl: string | null } | { candidates: TmdbCandidate[] | ItunesCandidate[] } | { error: string };

        if (SCREEN_TYPES.includes(media.media_type)) {
          if (!tmdbApiKey) { failed.push({ id: media.id, title: media.title, media_type: media.media_type, error: "Brak TMDB_API_KEY" }); continue; }
          result = await syncTmdb(media, tmdbApiKey);
          if ("candidates" in result) {
            needsReview.push({ id: media.id, title: media.title, media_type: media.media_type, source: "tmdb", candidates: result.candidates as TmdbCandidate[] });
            continue;
          }
        } else if (ITUNES_TYPES.includes(media.media_type)) {
          result = await syncItunes(media);
          if ("candidates" in result) {
            needsReview.push({ id: media.id, title: media.title, media_type: media.media_type, source: "itunes", candidates: result.candidates as ItunesCandidate[] });
            continue;
          }
        } else {
          failed.push({ id: media.id, title: media.title, media_type: media.media_type, error: "Nieobsługiwany typ" });
          continue;
        }

        if ("error" in result) {
          failed.push({ id: media.id, title: media.title, media_type: media.media_type, error: result.error });
        } else {
          synced.push({ id: media.id, title: media.title, media_type: media.media_type });
        }
      } catch (err) {
        failed.push({ id: media.id, title: media.title, media_type: media.media_type, error: String(err) });
      }
    }

    return NextResponse.json({ synced, needs_review: needsReview, failed, total: items.length });
  } catch (err) {
    console.error("bulk-sync error:", err);
    return NextResponse.json({ error: "Błąd synchronizacji" }, { status: 500 });
  }
}
