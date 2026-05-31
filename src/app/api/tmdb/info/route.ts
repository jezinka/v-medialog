import { NextRequest, NextResponse } from "next/server";
import { buildTmdbUrl, fetchTmdb, isTmdbTimeout, tmdbImageUrl } from "@/lib/tmdb";

export interface TmdbInfoResult {
  tmdb_id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: string[];
  vote_average: number;
  cast: { name: string; character: string; profile_path: string | null }[];
  // TV specific
  status?: string;
  first_air_date?: string;
  last_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  created_by?: { name: string }[];
  // Movie specific
  release_date?: string;
  runtime?: number;
  director?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildResult(d: any, tmdbId: number, isTv: boolean): TmdbInfoResult {
  const cast = ((d.credits?.cast ?? []) as Array<{ name: string; character: string; profile_path?: string | null }>)
    .slice(0, 12)
    .map((c) => ({
      name: c.name,
      character: c.character,
      profile_path: tmdbImageUrl(c.profile_path, "w45"),
    }));
  return {
    tmdb_id: tmdbId,
    title: isTv ? (d.name ?? "") : (d.title ?? ""),
    original_title: isTv ? (d.original_name ?? "") : (d.original_title ?? ""),
    overview: d.overview ?? "",
    poster_url: tmdbImageUrl(d.poster_path, "w342"),
    backdrop_url: tmdbImageUrl(d.backdrop_path, "w780"),
    genres: ((d.genres ?? []) as Array<{ name: string }>).map((g) => g.name),
    vote_average: d.vote_average ?? 0,
    cast,
    ...(isTv ? {
      status: d.status,
      first_air_date: d.first_air_date,
      last_air_date: d.last_air_date,
      number_of_seasons: d.number_of_seasons,
      number_of_episodes: d.number_of_episodes,
      created_by: ((d.created_by ?? []) as Array<{ name: string }>).map((c: { name: string }) => ({ name: c.name })),
    } : {
      release_date: d.release_date,
      runtime: d.runtime,
      director: ((d.credits?.crew ?? []) as Array<{ name: string; job: string }>).find((c) => c.job === "Director")?.name,
    }),
  };
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Brak TMDB_API_KEY" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const originalTitle = searchParams.get("original_title");
  const type = searchParams.get("type") || "series";
  const tmdbIdParam = searchParams.get("tmdb_id");
  const yearParam = searchParams.get("year");

  const searchQuery = originalTitle || title;
  const isTv = type === "series" || type === "anime";

  let tmdbId: number;
  let resolvedIsTv = isTv;

  try {
    if (tmdbIdParam) {
      tmdbId = parseInt(tmdbIdParam, 10);
      const firstUrl = buildTmdbUrl(`${isTv ? "tv" : "movie"}/${tmdbId}`, apiKey, { append_to_response: "credits" });
      const firstResult = await fetchTmdb<unknown>(firstUrl);
      if (!firstResult.ok) {
        resolvedIsTv = !isTv;
        const fallbackUrl = buildTmdbUrl(`${resolvedIsTv ? "tv" : "movie"}/${tmdbId}`, apiKey, { append_to_response: "credits" });
        const fallbackResult = await fetchTmdb<unknown>(fallbackUrl);
        if (!fallbackResult.ok) return NextResponse.json({ error: "Nie znaleziono w TMDB (sprawdzono tv i movie)" }, { status: 404 });
        return NextResponse.json(buildResult(fallbackResult.data, tmdbId, resolvedIsTv));
      }
      return NextResponse.json(buildResult(firstResult.data, tmdbId, resolvedIsTv));
    } else {
      if (!searchQuery) return NextResponse.json({ error: "Wymagany title lub tmdb_id" }, { status: 400 });

      const searchType = isTv ? "tv" : "movie";
      const searchExtra: Record<string, string> = { query: searchQuery };
      if (yearParam) searchExtra[isTv ? "first_air_date_year" : "year"] = yearParam;
      const searchUrl = buildTmdbUrl(`search/${searchType}`, apiKey, searchExtra);
      const searchResult = await fetchTmdb<{ results?: unknown[] }>(searchUrl);
      if (!searchResult.ok) return NextResponse.json({ error: `Nie znaleziono "${searchQuery}"` }, { status: 404 });
      const results = (searchResult.data.results ?? []) as Array<{ id: number; name?: string; title?: string; first_air_date?: string; release_date?: string; poster_path?: string | null }>;

      if (results.length === 0) return NextResponse.json({ error: `Nie znaleziono "${searchQuery}"` }, { status: 404 });

      if (results.length > 1) {
        return NextResponse.json({
          candidates: results.slice(0, 5).map((r) => ({
            tmdb_id: r.id,
            name: r.name ?? r.title ?? "",
            first_air_date: r.first_air_date ?? r.release_date ?? "",
            poster_path: tmdbImageUrl(r.poster_path, "w92"),
          })),
        });
      }

      tmdbId = results[0].id;
    }

    const detailUrl = buildTmdbUrl(`${resolvedIsTv ? "tv" : "movie"}/${tmdbId}`, apiKey, { append_to_response: "credits" });
    const detailResult = await fetchTmdb<unknown>(detailUrl);
    if (!detailResult.ok) return NextResponse.json({ error: "Błąd pobierania szczegółów z TMDB" }, { status: 502 });
    return NextResponse.json(buildResult(detailResult.data, tmdbId, resolvedIsTv));
  } catch (err) {
    return NextResponse.json(
      { error: isTmdbTimeout(err) ? "Timeout — brak odpowiedzi z TMDB (>10s)" : "Błąd połączenia z TMDB" },
      { status: 504 }
    );
  }
}
