import { NextResponse } from "next/server";
import { sqlite } from "@/db";
import { addUpcomingSeason } from "@/db/want-to-watch";

interface TmdbSeason {
  season_number: number;
  air_date: string | null;
  episode_count: number;
  name: string;
  poster_path: string | null;
}

interface TmdbShowDetails {
  name: string;
  status: string;
  next_episode_to_air: { season_number: number; air_date: string } | null;
  seasons: TmdbSeason[];
}

interface MediaRow {
  id: number;
  title: string;
  tmdb_id: number;
  media_type: string;
}

interface SeasonRow {
  season_number: number | null;
}

const SERIES_TYPES = ["series", "anime"];

export async function POST() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Brak TMDB_API_KEY" }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);

  // Get all ongoing series/anime with tmdb_id
  const serials = sqlite.prepare(`
    SELECT id, title, tmdb_id, media_type
    FROM media
    WHERE media_type IN (${SERIES_TYPES.map(() => "?").join(",")})
      AND discontinued = 0
      AND tmdb_id IS NOT NULL
  `).all(...SERIES_TYPES) as MediaRow[];

  const added: Array<{ title: string; season: number; air_date: string }> = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const serial of serials) {
    try {
      // Fetch TMDB show details with seasons
      const res = await fetch(
        `https://api.themoviedb.org/3/tv/${serial.tmdb_id}?api_key=${apiKey}&language=pl-PL`,
        { cache: "no-store", signal: AbortSignal.timeout(10_000) }
      );
      if (!res.ok) {
        errors.push(`${serial.title}: TMDB ${res.status}`);
        continue;
      }
      const show: TmdbShowDetails = await res.json();

      // Skip ended/cancelled shows
      if (show.status === "Ended" || show.status === "Canceled") {
        skipped.push(serial.title);
        continue;
      }

      // Find seasons already tracked in our DB (seasons table)
      const ourSeasons = sqlite.prepare(
        `SELECT season_number FROM seasons WHERE media_id = ? AND season_number IS NOT NULL ORDER BY season_number DESC`
      ).all(serial.id) as SeasonRow[];
      const maxTrackedSeason = ourSeasons.length > 0 ? (ourSeasons[0].season_number ?? 0) : 0;

      // Find future seasons from TMDB not yet tracked
      const upcomingSeasons = show.seasons.filter((s) => {
        if (s.season_number === 0) return false; // Skip specials
        if (s.season_number <= maxTrackedSeason) return false;
        if (!s.air_date) return false;
        return s.air_date >= today; // Future or today
      });

      // Also check next_episode_to_air for a season that might not be in seasons list yet
      const nextEp = show.next_episode_to_air;
      if (nextEp && nextEp.season_number > maxTrackedSeason && nextEp.air_date >= today) {
        const alreadyInUpcoming = upcomingSeasons.some((s) => s.season_number === nextEp.season_number);
        if (!alreadyInUpcoming) {
          upcomingSeasons.push({
            season_number: nextEp.season_number,
            air_date: nextEp.air_date,
            episode_count: 0,
            name: `Sezon ${nextEp.season_number}`,
            poster_path: null,
          });
        }
      }

      for (const season of upcomingSeasons) {
        const coverUrl = season.poster_path
          ? `https://image.tmdb.org/t/p/w185${season.poster_path}`
          : null;
        // The TMDB name gives the season its own title, so removing it from the list keeps it (and the job won't re-add it)
        const isNew = addUpcomingSeason(sqlite, {
          mediaId: serial.id,
          seasonNumber: season.season_number,
          title: season.name || null,
          coverUrl,
          airDate: season.air_date,
        });
        if (!isNew) continue;

        added.push({ title: serial.title, season: season.season_number, air_date: season.air_date ?? "" });
      }
    } catch (err) {
      errors.push(`${serial.title}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  // Read by the scheduler in db/index.ts; when every request failed (TMDB down) it retries on its next tick
  if (serials.length === 0 || errors.length < serials.length) sqlite.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('last_upcoming_check', ?)`).run(new Date().toISOString());

  return NextResponse.json({
    checked: serials.length,
    added: added.length,
    skipped: skipped.length,
    errors: errors.length,
    items: added,
    error_list: errors,
  });
}
