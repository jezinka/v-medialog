import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/podcast/episodes?url=https://podcasts.apple.com/...
 * GET /api/podcast/episodes?id=1586789127
 *
 * Returns { dates: string[] } — sorted unique YYYY-MM-DD release dates of all episodes
 * fetched from the iTunes podcast lookup API (up to 300 episodes).
 */

interface ItunesEpisode {
  wrapperType?: string;
  releaseDate?: string;
}

function extractPodcastId(url: string): string | null {
  // https://podcasts.apple.com/us/podcast/name/id1586789127
  const match = url.match(/\/id(\d+)/);
  return match ? match[1] : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const id = url ? extractPodcastId(url) : searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Wymagany parametr url lub id" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${id}&entity=podcastEpisode&limit=300`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      return NextResponse.json({ error: "Błąd iTunes API" }, { status: 502 });
    }

    const data = await res.json() as { results: ItunesEpisode[] };

    const dates = data.results
      .filter((r) => r.wrapperType === "podcastEpisode" && r.releaseDate)
      .map((r) => r.releaseDate!.slice(0, 10))
      .filter((d, i, arr) => arr.indexOf(d) === i) // deduplicate same-day episodes
      .sort();

    return NextResponse.json({ dates });
  } catch {
    return NextResponse.json({ error: "Błąd sieci" }, { status: 502 });
  }
}
