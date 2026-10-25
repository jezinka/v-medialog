import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { addUpcomingSeason } from "@/db/want-to-watch";
import { badRequest, jsonError, serverError } from "@/lib/api-helpers";
import { downloadCover } from "@/lib/covers";
import { monthRange } from "@/lib/schedule";
import { buildTmdbUrl, fetchTmdb, isTmdbTimeout } from "@/lib/tmdb";
import { NEW_SERIES_COUNTRIES, NEW_SERIES_EXCLUDED_GENRES, NEW_SERIES_NETWORKS, toNewSeriesItems } from "@/lib/new-series";

type DiscoverPage = { results?: Parameters<typeof toNewSeriesItems>[0]; total_pages?: number };

/**
 * GET /api/schedule/new-series?month=YYYY-MM
 * Series from PL / US / GB premiering in the month on networks that stream in Poland, most popular first.
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return jsonError("Brak TMDB_API_KEY", 500);
  const range = monthRange(new URL(request.url).searchParams.get("month") ?? "");
  if (!range) return badRequest("month must be YYYY-MM");

  try {
    const results: NonNullable<DiscoverPage["results"]> = [];
    // ponytail: two pages (40 shows) is plenty for one month; more would be noise
    for (let page = 1; page <= 2; page++) {
      const res = await fetchTmdb<DiscoverPage>(buildTmdbUrl("discover/tv", apiKey, {
        "first_air_date.gte": range.first,
        "first_air_date.lte": range.last,
        with_origin_country: NEW_SERIES_COUNTRIES.join("|"),
        with_networks: Object.keys(NEW_SERIES_NETWORKS).join("|"),
        without_genres: NEW_SERIES_EXCLUDED_GENRES.join("|"),
        sort_by: "popularity.desc",
        page: String(page),
      }));
      if (!res.ok) return jsonError("Błąd TMDB", 502);
      results.push(...(res.data.results ?? []));
      if ((res.data.total_pages ?? 1) <= page) break;
    }

    const library = sqlite.prepare(
      `SELECT tmdb_id, id FROM media WHERE tmdb_id IS NOT NULL AND media_type IN ('series', 'anime')`
    ).all() as { tmdb_id: number; id: number }[];
    const items = toNewSeriesItems(results, new Map(library.map((r) => [r.tmdb_id, r.id])));
    return NextResponse.json({ items });
  } catch (error) {
    if (isTmdbTimeout(error)) return jsonError("Timeout — brak odpowiedzi z TMDB", 504);
    console.error(error);
    return serverError("Failed to load new series");
  }
}

/**
 * POST /api/schedule/new-series { tmdb_id, title, original_title?, poster_url?, first_air_date }
 * Puts the show on the watch list: creates the series (or reuses the one with this TMDB id) and its
 * season 1 with a premiere marker, so it also shows among the followed premieres.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      tmdb_id?: number; title?: string; original_title?: string; poster_url?: string | null; first_air_date?: string;
    };
    if (!Number.isInteger(body.tmdb_id) || !body.title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(body.first_air_date ?? "")) {
      return badRequest("tmdb_id, title and first_air_date are required");
    }
    const tmdbId = body.tmdb_id!;
    const existing = sqlite.prepare(
      `SELECT id FROM media WHERE tmdb_id=? AND media_type IN ('series', 'anime')`
    ).get(tmdbId) as { id: number } | undefined;
    // Only TMDB poster URLs are fetched; anything else is ignored
    const cover = !existing && body.poster_url?.startsWith("https://image.tmdb.org/") ? await downloadCover(body.poster_url) : null;

    const mediaId = sqlite.transaction(() => {
      const id = existing?.id ?? Number(sqlite.prepare(
        `INSERT INTO media (title, original_title, media_type, cover_url, tmdb_id, discontinued) VALUES (?, ?, 'series', ?, ?, 0)`
      ).run(body.title!.trim(), body.original_title?.trim() || null, cover, tmdbId).lastInsertRowid);
      addUpcomingSeason(sqlite, { mediaId: id, seasonNumber: 1, title: null, coverUrl: null, airDate: body.first_air_date! });
      return id;
    })();
    return NextResponse.json({ media_id: mediaId }, { status: 201 });
  } catch (error) {
    console.error(error);
    return serverError("Failed to add series");
  }
}
