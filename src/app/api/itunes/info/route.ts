import { NextRequest, NextResponse } from "next/server";
import {
  collectionIdOf, fetchTracks, hiResCover, itunesGenres, parseYear, searchItunes, toItunesCandidate,
  type ItunesApiResult, type ItunesTrack,
} from "@/lib/itunes";

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
  tracks: ItunesTrack[] | null;
}

function mapResult(item: ItunesApiResult, tracks: ItunesInfoResult["tracks"] = null): ItunesInfoResult {
  return {
    itunes_id: collectionIdOf(item),
    title: item.collectionName ?? item.trackName ?? "",
    artist: item.artistName ?? "",
    description: item.longDescription ?? item.description ?? null,
    genres: itunesGenres(item),
    release_year: parseYear(item.releaseDate),
    cover_url: hiResCover(item.artworkUrl100),
    track_count: item.trackCount ?? null,
    itunes_url: item.collectionViewUrl ?? item.trackViewUrl ?? null,
    tracks,
  };
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
      const collectionId = collectionIdOf(item);
      const tracks = type === "record" ? await fetchTracks(collectionId) : null;
      return NextResponse.json(mapResult(item, tracks));
    } catch {
      return NextResponse.json({ error: "Błąd sieci" }, { status: 502 });
    }
  }

  if (!title) return NextResponse.json({ error: "Wymagany parametr title lub itunes_id" }, { status: 400 });

  const term = artist ? `${title} ${artist}` : title;

  try {
    const results = await searchItunes(term, type);
    if (!results) return NextResponse.json({ error: "Błąd iTunes" }, { status: 502 });
    if (results.length === 0) return NextResponse.json({ error: `Nie znaleziono "${term}"` }, { status: 404 });

    // Single result → return directly with tracks
    if (results.length === 1) {
      const item = results[0];
      const tracks = type === "record" ? await fetchTracks(collectionIdOf(item)) : null;
      return NextResponse.json(mapResult(item, tracks));
    }

    return NextResponse.json({ candidates: results.slice(0, 6).map(toItunesCandidate) });
  } catch {
    return NextResponse.json({ error: "Błąd sieci" }, { status: 502 });
  }
}
