import { NextRequest, NextResponse } from "next/server";

const BOOK_TYPES = ["book", "comic"];
const NO_SEARCH_TYPES = ["play", "game", "podcast", "record"];

interface SearchResult {
  title: string;
  author: string | null;
  coverUrl: string | null;
  year: string | null;
  sourceId: string;
  pages?: number | null;
  subjects?: string[] | null;
  overview?: string | null;
}

async function searchOpenLibrary(query: string): Promise<SearchResult[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,cover_i,first_publish_year,subject,number_of_pages_median,isbn`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.docs ?? []).map((doc: {
    key?: string;
    title?: string;
    author_name?: string[];
    cover_i?: number;
    first_publish_year?: number;
    subject?: string[];
    number_of_pages_median?: number;
  }) => ({
    title: doc.title ?? "",
    author: doc.author_name?.[0] ?? null,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    year: doc.first_publish_year ? String(doc.first_publish_year) : null,
    sourceId: doc.key ?? "",
    pages: doc.number_of_pages_median ?? null,
    subjects: doc.subject ? doc.subject.slice(0, 5) : null,
    overview: null,
  }));
}

async function searchTMDB(query: string, type: string): Promise<SearchResult[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];

  const endpoint = (type === "movie") ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const data = await res.json();

  return (data.results ?? []).slice(0, 8).map((item: {
    id?: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    poster_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    overview?: string;
  }) => ({
    title: item.title ?? item.name ?? "",
    original_title: item.original_title ?? item.original_name ?? null,
    author: null,
    coverUrl: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : null,
    year: (item.release_date ?? item.first_air_date ?? "").split("-")[0] || null,
    sourceId: `tmdb:${item.id ?? ""}`,
    pages: null,
    subjects: null,
    overview: item.overview || null,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const type = searchParams.get("type") ?? "book";

  if (!query || query.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    let results: SearchResult[];
    if (NO_SEARCH_TYPES.includes(type)) {
      results = [];
    } else if (BOOK_TYPES.includes(type)) {
      results = await searchOpenLibrary(query.trim());
    } else {
      results = await searchTMDB(query.trim(), type);
    }
    return NextResponse.json(results);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json([]);
  }
}
