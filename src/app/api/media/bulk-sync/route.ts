import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { SCREEN_TYPES, ITUNES_TYPES } from "@/lib/utils";
import { downloadCover } from "@/lib/covers";
import { replaceMediaPersons, type PersonInput } from "@/lib/media-persons";
import { buildTmdbUrl, fetchTmdb, tmdbCandidates, tmdbImageUrl, tmdbPersons, type TmdbCandidate } from "@/lib/tmdb";
import {
  collectionIdOf, fetchTracks, hiResCover, itunesGenres, parseYear, searchItunes, toItunesCandidate,
  type ItunesCandidate, type ItunesTrack,
} from "@/lib/itunes";

export type { TmdbCandidate, ItunesCandidate };

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

    replaceMediaPersons(mediaId, data.persons ?? []);
  });
  doSave();
}

async function saveCover(mediaId: number, remoteUrl: string | null): Promise<string | null> {
  const path = remoteUrl ? await downloadCover(remoteUrl) : null;
  if (path) sqlite.prepare(`UPDATE media SET cover_url=?, updated_at=datetime('now') WHERE id=?`).run(path, mediaId);
  return path;
}

async function syncTmdb(media: MediaRow, apiKey: string): Promise<{ ok: true; coverUrl: string | null } | { candidates: TmdbCandidate[] } | { error: string }> {
  const isTv = media.media_type === "series" || media.media_type === "anime";
  let tmdbId = media.tmdb_id;

  if (!tmdbId) {
    const searchQuery = media.original_title || media.title;
    const search = await fetchTmdb<{ results?: Parameters<typeof tmdbCandidates>[0] }>(
      buildTmdbUrl(`search/${isTv ? "tv" : "movie"}`, apiKey, { query: searchQuery })
    );
    const results = search.ok ? (search.data.results ?? []) : [];

    if (results.length === 0) return { error: `Nie znaleziono "${searchQuery}"` };
    if (results.length > 1) return { candidates: tmdbCandidates(results) };
    tmdbId = results[0].id;
  }

  const detail = await fetchTmdb<unknown>(
    buildTmdbUrl(`${isTv ? "tv" : "movie"}/${tmdbId}`, apiKey, { append_to_response: "credits" })
  );
  if (!detail.ok) return { error: "Błąd pobierania szczegółów z TMDB" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = detail.data as any;
  const dateStr = isTv ? (d.first_air_date as string | undefined) : (d.release_date as string | undefined);
  const releaseYear = dateStr ? parseInt(dateStr.slice(0, 4)) || null : null;
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
    persons: tmdbPersons(d, isTv),
  });

  return { ok: true, coverUrl: await saveCover(media.id, tmdbImageUrl(d.poster_path, "w342")) };
}

async function syncItunes(media: MediaRow): Promise<{ ok: true; coverUrl: string | null } | { candidates: ItunesCandidate[] } | { error: string }> {
  const title = media.original_title ?? media.title;
  const term = media.author ? `${title} ${media.author}` : title;
  const results = (await searchItunes(term, media.media_type)) ?? [];

  if (results.length === 0) return { error: `Nie znaleziono "${term}"` };
  if (results.length > 1) return { candidates: results.slice(0, 6).map(toItunesCandidate) };

  const item = results[0];
  const collectionId = collectionIdOf(item);
  const trackList: ItunesTrack[] | null =
    media.media_type === "record" && collectionId ? await fetchTracks(collectionId) : null;

  saveExternalToDb(media.id, {
    ol_key: `itunes:${collectionId}`,
    description: item.longDescription ?? item.description ?? null,
    genres: itunesGenres(item),
    release_year: parseYear(item.releaseDate),
    track_list: trackList,
    persons: media.author ? [{ name: media.author, role: "author", display_order: 0 }] : [],
  });

  return { ok: true, coverUrl: await saveCover(media.id, hiResCover(item.artworkUrl100)) };
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
