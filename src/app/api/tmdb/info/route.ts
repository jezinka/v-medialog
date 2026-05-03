import { NextRequest, NextResponse } from "next/server";

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
function buildResult(d: any, tmdbId: number, isTv: boolean, apiKey: string): TmdbInfoResult {
  void apiKey; // available for future use
  const cast = ((d.credits?.cast ?? []) as Array<{ name: string; character: string; profile_path?: string | null }>)
    .slice(0, 12)
    .map((c) => ({
      name: c.name,
      character: c.character,
      profile_path: c.profile_path ? `https://image.tmdb.org/t/p/w45${c.profile_path}` : null,
    }));
  return {
    tmdb_id: tmdbId,
    title: isTv ? (d.name ?? "") : (d.title ?? ""),
    original_title: isTv ? (d.original_name ?? "") : (d.original_title ?? ""),
    overview: d.overview ?? "",
    poster_url: d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : null,
    backdrop_url: d.backdrop_path ? `https://image.tmdb.org/t/p/w780${d.backdrop_path}` : null,
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
      // Try the type-based endpoint first; if it fails (e.g. ID is for the other type), try the other
      const firstEndpoint = isTv
        ? `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}&language=pl-PL&append_to_response=credits`
        : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=pl-PL&append_to_response=credits`;
      const firstRes = await fetch(firstEndpoint, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!firstRes.ok) {
        // Fallback: try the other type
        resolvedIsTv = !isTv;
        const fallbackEndpoint = resolvedIsTv
          ? `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}&language=pl-PL&append_to_response=credits`
          : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=pl-PL&append_to_response=credits`;
        const fallbackRes = await fetch(fallbackEndpoint, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!fallbackRes.ok) return NextResponse.json({ error: "Nie znaleziono w TMDB (sprawdzono tv i movie)" }, { status: 404 });
        const d = await fallbackRes.json();
        return NextResponse.json(buildResult(d, tmdbId, resolvedIsTv, apiKey));
      }
      const d = await firstRes.json();
      return NextResponse.json(buildResult(d, tmdbId, resolvedIsTv, apiKey));
    } else {
      if (!searchQuery) return NextResponse.json({ error: "Wymagany title lub tmdb_id" }, { status: 400 });

      const searchType = isTv ? "tv" : "movie";
      let searchUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}&language=pl-PL`;
      if (yearParam) {
        searchUrl += isTv ? `&first_air_date_year=${yearParam}` : `&year=${yearParam}`;
      }
      const searchRes = await fetch(searchUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      const searchData = await searchRes.json();
      const results = (searchData.results ?? []) as Array<{ id: number; name?: string; title?: string; first_air_date?: string; release_date?: string; poster_path?: string | null }>;

      if (results.length === 0) return NextResponse.json({ error: `Nie znaleziono "${searchQuery}"` }, { status: 404 });

      if (results.length > 1) {
        return NextResponse.json({
          candidates: results.slice(0, 5).map((r) => ({
            tmdb_id: r.id,
            name: r.name ?? r.title ?? "",
            first_air_date: r.first_air_date ?? r.release_date ?? "",
            poster_path: r.poster_path ? `https://image.tmdb.org/t/p/w92${r.poster_path}` : null,
          })),
        });
      }

      tmdbId = results[0].id;
    }

    const endpoint = resolvedIsTv
      ? `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}&language=pl-PL&append_to_response=credits`
      : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=pl-PL&append_to_response=credits`;

    const detailRes = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!detailRes.ok) return NextResponse.json({ error: "Błąd pobierania szczegółów z TMDB" }, { status: 502 });

    const d = await detailRes.json();
    return NextResponse.json(buildResult(d, tmdbId, resolvedIsTv, apiKey));
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json(
      { error: isTimeout ? "Timeout — brak odpowiedzi z TMDB (>10s)" : "Błąd połączenia z TMDB" },
      { status: 504 }
    );
  }
}
