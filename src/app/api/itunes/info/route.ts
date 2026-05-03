import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/itunes/info?title=...&artist=...&type=record|podcast
 * GET /api/itunes/info?itunes_id=...&type=record|podcast
 */

export interface ItunesInfoResult {
  itunes_id: number;
  title: string;
  artist: string;
  description: string | null;
  genres: string[];
  release_year: number | null;
  cover_url: string | null;
  track_count: number | null;
  itunes_url: string | null;
  tracks: Array<{ number: number; title: string; duration_ms: number | null }> | null;
}

type ItunesCandidate = {
  itunes_id: number;
  title: string;
  artist: string;
  year: number | null;
  cover_url: string | null;
};

interface ItunesApiResult {
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  collectionViewUrl?: string;
  trackViewUrl?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  genres?: string[];
  releaseDate?: string;
  trackCount?: number;
  trackNumber?: number;
  trackTimeMillis?: number;
  description?: string;
  longDescription?: string;
  feedUrl?: string;
  wrapperType?: string;
  kind?: string;
}

function hiResCover(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace("100x100bb", "600x600bb");
}

function parseYear(dateStr?: string): number | null {
  if (!dateStr) return null;
  const y = parseInt(dateStr.slice(0, 4));
  return isNaN(y) ? null : y;
}

function mapResult(item: ItunesApiResult, type: string, tracks: ItunesInfoResult["tracks"] = null): ItunesInfoResult {
  const id = item.collectionId ?? item.trackId ?? 0;
  const title = item.collectionName ?? item.trackName ?? "";
  const genres: string[] = item.genres ?? (item.primaryGenreName ? [item.primaryGenreName] : []);
  return {
    itunes_id: id,
    title,
    artist: item.artistName ?? "",
    description: item.longDescription ?? item.description ?? null,
    genres: genres.filter((g) => g !== "Music" && g !== "Podcast"),
    release_year: parseYear(item.releaseDate),
    cover_url: hiResCover(item.artworkUrl100),
    track_count: item.trackCount ?? null,
    itunes_url: item.collectionViewUrl ?? item.trackViewUrl ?? null,
    tracks,
  };
}

async function fetchTracks(collectionId: number): Promise<ItunesInfoResult["tracks"]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&country=PL`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json() as { results: ItunesApiResult[] };
    const songs = data.results.filter((r) => r.wrapperType === "track" && r.trackName);
    if (!songs.length) return null;
    return songs
      .sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0))
      .map((s) => ({
        number: s.trackNumber ?? 0,
        title: s.trackName ?? "",
        duration_ms: s.trackTimeMillis ?? null,
      }));
  } catch {
    return null;
  }
}

function extractIdFromAppleMusicUrl(url: string): string | null {
  // https://music.apple.com/pl/album/album-name/1845877116
  const match = url.match(/music\.apple\.com\/[^/]+\/(?:album|podcast)[^/]*\/(?:[^/]+\/)?(\d+)/);
  return match ? match[1] : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "record";
  const appleMusicUrl = searchParams.get("apple_music_url");
  const itunesId = appleMusicUrl ? extractIdFromAppleMusicUrl(appleMusicUrl) : searchParams.get("itunes_id");
  const title = searchParams.get("title");
  const artist = searchParams.get("artist");

  const entity = type === "podcast" ? "podcast" : "album";
  const mediaType = type === "podcast" ? "podcast" : "music";

  // Direct ID lookup
  if (itunesId) {
    try {
      // For ID lookup, do NOT pass entity — iTunes interprets id+entity as "albums by artist ID"
      // which gives wrong results. Plain lookup?id=... works for collectionId and trackId.
      const lookupUrl = type === "podcast"
        ? `https://itunes.apple.com/lookup?id=${itunesId}&entity=podcast`
        : `https://itunes.apple.com/lookup?id=${itunesId}`;
      const res = await fetch(lookupUrl, { cache: "no-store" });
      if (!res.ok) return NextResponse.json({ error: "Błąd iTunes" }, { status: 502 });
      const data = await res.json() as { results: ItunesApiResult[] };
      // For non-podcast, filter to collection/album results (skip artist entries)
      const items = data.results ?? [];
      const item = type === "podcast"
        ? items[0]
        : (items.find((r) => r.wrapperType === "collection" || r.collectionId != null) ?? items[0]);
      if (!item) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
      const collectionId = item.collectionId ?? item.trackId ?? 0;
      const tracks = type === "record" ? await fetchTracks(collectionId) : null;
      return NextResponse.json(mapResult(item, type, tracks));
    } catch {
      return NextResponse.json({ error: "Błąd sieci" }, { status: 502 });
    }
  }

  if (!title) return NextResponse.json({ error: "Wymagany parametr title lub itunes_id" }, { status: 400 });

  const term = artist ? `${title} ${artist}` : title;
  const params = new URLSearchParams({
    term,
    entity,
    media: mediaType,
    limit: "8",
    country: "PL",
  });

  try {
    const res = await fetch(`https://itunes.apple.com/search?${params}`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: "Błąd iTunes" }, { status: 502 });
    const data = await res.json() as { resultCount: number; results: ItunesApiResult[] };

    if (data.resultCount === 0) {
      // Retry without country restriction
      const res2 = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&media=${mediaType}&limit=8`,
        { cache: "no-store" }
      );
      if (res2.ok) {
        const data2 = await res2.json() as { resultCount: number; results: ItunesApiResult[] };
        if (data2.resultCount === 0) return NextResponse.json({ error: `Nie znaleziono "${term}"` }, { status: 404 });
        data.resultCount = data2.resultCount;
        data.results = data2.results;
      }
    }

    if (data.results.length === 0) return NextResponse.json({ error: `Nie znaleziono "${term}"` }, { status: 404 });

    // Single result → return directly with tracks
    if (data.results.length === 1) {
      const item = data.results[0];
      const collectionId = item.collectionId ?? item.trackId ?? 0;
      const tracks = type === "record" ? await fetchTracks(collectionId) : null;
      return NextResponse.json(mapResult(item, type, tracks));
    }

    // Multiple → return candidates
    return NextResponse.json({
      candidates: data.results.slice(0, 6).map((item): ItunesCandidate => ({
        itunes_id: item.collectionId ?? item.trackId ?? 0,
        title: item.collectionName ?? item.trackName ?? "",
        artist: item.artistName ?? "",
        year: parseYear(item.releaseDate),
        cover_url: hiResCover(item.artworkUrl100),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Błąd sieci" }, { status: 502 });
  }
}
