import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { addUpcomingSeason } from "@/db/want-to-watch";
import { badRequest, jsonError, serverError } from "@/lib/api-helpers";
import { downloadCover } from "@/lib/covers";
import { monthRange } from "@/lib/schedule";
import { buildTmdbUrl, fetchTmdb, isTmdbTimeout } from "@/lib/tmdb";
import { NEW_SERIES_COUNTRIES, NEW_SERIES_EXCLUDED_GENRES, NEW_SERIES_NETWORKS, parseNewSeriesInput, toNewSeriesItems } from "@/lib/new-series";

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
    const results = await discover(apiKey, range, "pl-PL");
    if (!results) return jsonError("Błąd TMDB", 502);
    // Many new shows have no Polish overview yet; the same query in English fills them in
    const fallbackOverviews = new Map<number, string>();
    if (results.some((r) => r.first_air_date && !r.overview)) {
      for (const r of (await discover(apiKey, range, "en-US")) ?? []) if (r.overview) fallbackOverviews.set(r.id, r.overview);
    }

    const library = sqlite.prepare(
      `SELECT tmdb_id, id FROM media WHERE tmdb_id IS NOT NULL AND media_type IN ('series', 'anime')`
    ).all() as { tmdb_id: number; id: number }[];
    const items = toNewSeriesItems(results, new Map(library.map((r) => [r.tmdb_id, r.id])), fallbackOverviews);
    return NextResponse.json({ items });
  } catch (error) {
    if (isTmdbTimeout(error)) return jsonError("Timeout — brak odpowiedzi z TMDB", 504);
    console.error(error);
    return serverError("Failed to load new series");
  }
}

/** Discover results for the month in `language`; null when TMDB answers with an error */
async function discover(apiKey: string, range: { first: string; last: string }, language: string) {
  const results: NonNullable<DiscoverPage["results"]> = [];
  // ponytail: two pages (40 shows) is plenty for one month; more would be noise
  for (let page = 1; page <= 2; page++) {
    const res = await fetchTmdb<DiscoverPage>(buildTmdbUrl("discover/tv", apiKey, {
      language,
      "first_air_date.gte": range.first,
      "first_air_date.lte": range.last,
      with_origin_country: NEW_SERIES_COUNTRIES.join("|"),
      with_networks: Object.keys(NEW_SERIES_NETWORKS).join("|"),
      without_genres: NEW_SERIES_EXCLUDED_GENRES.join("|"),
      sort_by: "popularity.desc",
      page: String(page),
    }));
    if (!res.ok) return null;
    results.push(...(res.data.results ?? []));
    if ((res.data.total_pages ?? 1) <= page) break;
  }
  return results;
}

/**
 * POST /api/schedule/new-series { tmdb_id, title, original_title?, poster_url?, first_air_date } → { media_id, added }
 * Puts the show on the watch list: creates the series (or reuses the one with this TMDB id) and its
 * season 1 with a premiere marker, so it also shows among the followed premieres.
 */
export async function POST(request: NextRequest) {
  try {
    const input = parseNewSeriesInput(await request.json().catch(() => null));
    if (!input) return badRequest("tmdb_id, title and a valid first_air_date are required");

    const findSeries = sqlite.prepare(`SELECT id FROM media WHERE tmdb_id=? AND media_type IN ('series', 'anime')`);
    // Poster first (a network call can't sit inside the transaction); only TMDB image URLs are fetched
    const cover = !findSeries.get(input.tmdb_id) && input.poster_url?.startsWith("https://image.tmdb.org/")
      ? await downloadCover(input.poster_url)
      : null;

    // The lookup is repeated inside the transaction, so two adds of one show can't both insert it
    const result = sqlite.transaction(() => {
      const existing = findSeries.get(input.tmdb_id) as { id: number } | undefined;
      const mediaId = existing?.id ?? Number(sqlite.prepare(
        `INSERT INTO media (title, original_title, media_type, cover_url, tmdb_id, discontinued) VALUES (?, ?, 'series', ?, ?, 0)`
      ).run(input.title, input.original_title, cover, input.tmdb_id).lastInsertRowid);
      const added = addUpcomingSeason(sqlite, { mediaId, seasonNumber: 1, title: null, coverUrl: null, airDate: input.first_air_date });
      return { media_id: mediaId, added: added || !existing };
    }).immediate();
    return NextResponse.json(result, { status: result.added ? 201 : 200 });
  } catch (error) {
    console.error(error);
    return serverError("Failed to add series");
  }
}
