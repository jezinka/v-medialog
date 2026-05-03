import { NextResponse } from "next/server";
import { sqlite } from "@/db";

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
  cover_url: string | null;
}

interface SeasonRow {
  season_number: number | null;
}

interface ListRow {
  id: number;
}

const SERIES_TYPES = ["series", "anime", "cartoon"];

export async function POST() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Brak TMDB_API_KEY" }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);

  // Find or create "Nowe sezony" list
  let list = sqlite.prepare(`SELECT id FROM reading_lists WHERE name = 'Nowe sezony'`).get() as ListRow | undefined;
  if (!list) {
    const res = sqlite.prepare(`INSERT INTO reading_lists (name, description) VALUES (?, ?)`).run(
      "Nowe sezony",
      "Automatycznie wykryte nadchodzące sezony seriali"
    );
    list = { id: res.lastInsertRowid as number };
  }
  const listId = list.id;

  // Get all ongoing series/anime/cartoon with tmdb_id
  const serials = sqlite.prepare(`
    SELECT id, title, tmdb_id, media_type, cover_url
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
        { cache: "no-store" }
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
        // Check if already in reading list for this media + season
        const existing = sqlite.prepare(`
          SELECT id FROM reading_list_items
          WHERE media_id = ? AND season_number = ? AND list_id = ?
        `).get(serial.id, season.season_number, listId);

        if (existing) continue;

        // Add to reading list
        const coverUrl = season.poster_path
          ? `https://image.tmdb.org/t/p/w185${season.poster_path}`
          : serial.cover_url;

        sqlite.prepare(`
          INSERT INTO reading_list_items (list_id, title, media_type, cover_url, media_id, season_number, season_start_date, auto_added, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).run(
          listId,
          `${serial.title} — Sezon ${season.season_number}`,
          serial.media_type,
          coverUrl,
          serial.id,
          season.season_number,
          season.air_date,
          `TMDB status: ${show.status}`
        );

        added.push({ title: serial.title, season: season.season_number, air_date: season.air_date ?? "" });
      }
    } catch (err) {
      errors.push(`${serial.title}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return NextResponse.json({
    checked: serials.length,
    added: added.length,
    skipped: skipped.length,
    errors: errors.length,
    items: added,
    error_list: errors,
    list_id: listId,
  });
}
