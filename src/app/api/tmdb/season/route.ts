import { NextRequest, NextResponse } from "next/server";

interface TmdbSearchResult {
  id: number;
  name?: string;
  original_name?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
}

interface TmdbEpisode {
  episode_number: number;
  air_date?: string | null;
}

interface TmdbSeason {
  episodes?: TmdbEpisode[];
  poster_path?: string | null;
}

export interface SeasonDatesResult {
  tmdb_id: number;
  show_name: string;
  season: number;
  start_date: string | null;
  end_date: string | null;
  episode_count: number;
  episode_dates: string[]; // unique sorted air dates for all episodes
  poster_path: string | null;      // show poster
  season_poster_path: string | null; // season-specific poster
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Brak klucza TMDB_API_KEY w .env.local" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const originalTitle = searchParams.get("original_title");
  const seasonParam = searchParams.get("season");
  const tmdbIdParam = searchParams.get("tmdb_id");

  if (!title && !originalTitle && !tmdbIdParam) {
    return NextResponse.json({ error: "Wymagany parametr: title lub tmdb_id" }, { status: 400 });
  }

  // Use original_title for API search if available (more accurate for non-English titles)
  const searchQuery = originalTitle || title!;

  const seasonNum = seasonParam ? parseInt(seasonParam, 10) : 1;
  if (isNaN(seasonNum) || seasonNum < 1) {
    return NextResponse.json({ error: "Nieprawidłowy numer sezonu" }, { status: 400 });
  }

  try {
    let tmdbId: number;
    let showName: string;
    let posterPath: string | null = null;
    let searchResults: TmdbSearchResult[] = [];

    if (tmdbIdParam) {
      tmdbId = parseInt(tmdbIdParam, 10);
      // Fetch show details to get name
      const showRes = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}&language=pl-PL`,
        { cache: "no-store", signal: AbortSignal.timeout(10000) }
      );
      if (!showRes.ok) {
        return NextResponse.json({ error: "Nie znaleziono serialu o podanym ID" }, { status: 404 });
      }
      const showData = await showRes.json();
      showName = showData.name ?? showData.original_name ?? title;
      posterPath = showData.poster_path ?? null;
    } else {
      // Search by title
      const searchRes = await fetch(
        `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}&page=1&language=pl-PL`,
        { cache: "no-store", signal: AbortSignal.timeout(10000) }
      );
      if (!searchRes.ok) {
        return NextResponse.json({ error: "Błąd wyszukiwania TMDB" }, { status: 502 });
      }
      const searchData = await searchRes.json();
      searchResults = (searchData.results ?? []) as TmdbSearchResult[];

      if (searchResults.length === 0) {
        return NextResponse.json({ error: `Nie znaleziono serialu "${searchQuery}" w TMDB` }, { status: 404 });
      }

      // Return candidates if multiple results and no tmdb_id specified
      if (searchResults.length > 1) {
        return NextResponse.json({
          candidates: searchResults.slice(0, 5).map((r) => ({
            tmdb_id: r.id,
            name: r.name ?? r.original_name ?? "",
            first_air_date: r.first_air_date ?? "",
            poster_path: r.poster_path ? `https://image.tmdb.org/t/p/w92${r.poster_path}` : null,
          })),
        });
      }

      tmdbId = searchResults[0].id;
      showName = searchResults[0].name ?? searchResults[0].original_name ?? (title ?? searchQuery);
      posterPath = searchResults[0].poster_path ?? null;
    }

    // Fetch season details
    const seasonRes = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNum}?api_key=${apiKey}&language=pl-PL`,
      { cache: "no-store", signal: AbortSignal.timeout(10000) }
    );
    if (!seasonRes.ok) {
      return NextResponse.json({ error: `Sezon ${seasonNum} nie znaleziony w TMDB` }, { status: 404 });
    }
    const seasonData: TmdbSeason = await seasonRes.json();
    const episodes = (seasonData.episodes ?? []).filter((e) => e.air_date);

    if (episodes.length === 0) {
      return NextResponse.json({ error: `Brak dat emisji dla sezonu ${seasonNum}` }, { status: 404 });
    }

    const dates = episodes.map((e) => e.air_date as string).sort();
    // Unique dates (some platforms drop multiple episodes on same day)
    const uniqueDates = [...new Set(dates)];
    const startDate = uniqueDates[0];
    const endDate = uniqueDates[uniqueDates.length - 1];

    const result: SeasonDatesResult = {
      tmdb_id: tmdbId,
      show_name: showName,
      season: seasonNum,
      start_date: startDate,
      end_date: endDate,
      episode_count: episodes.length,
      episode_dates: uniqueDates,
      poster_path: posterPath ? `https://image.tmdb.org/t/p/w185${posterPath}` : null,
      season_poster_path: seasonData.poster_path
        ? `https://image.tmdb.org/t/p/w185${seasonData.poster_path}`
        : null,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("TMDB season fetch error:", err);
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json({ error: isTimeout ? "Timeout — brak odpowiedzi z TMDB (>10s)" : "Błąd połączenia z TMDB" }, { status: 504 });
  }
}
