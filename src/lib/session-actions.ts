export async function createSessionForMedia(
  mediaId: number,
  startDate: string,
  endDate: string
): Promise<void> {
  const seasonsRes = await fetch(`/api/seasons?media_id=${mediaId}`);
  if (!seasonsRes.ok) throw new Error("Nie udało się pobrać sezonów");
  const seasons: { id: number }[] = await seasonsRes.json();

  let seasonId: number;
  if (seasons.length === 0) {
    const createSeasonRes = await fetch("/api/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: mediaId, season_number: 1, title: null, want_to_watch: 0 }),
    });
    const season = await createSeasonRes.json() as { id?: number; error?: string };
    if (!createSeasonRes.ok) throw new Error(season.error ?? "Nie udało się utworzyć sezonu");
    if (!season.id) throw new Error("Nieprawidłowa odpowiedź serwera (brak id sezonu)");
    seasonId = season.id;
  } else {
    seasonId = seasons[0].id;
  }

  const sessionRes = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      season_id: seasonId,
      start_date: startDate,
      end_date: endDate !== startDate ? endDate : null,
    }),
  });
  if (!sessionRes.ok) {
    const errorBody = await sessionRes.json() as { error?: string };
    throw new Error(errorBody.error ?? "Nie udało się utworzyć sesji");
  }
}

/** Adds a one-day session on each date to the season, skipping failures; returns how many were saved. */
export async function addDaySessions(
  seasonId: number,
  dates: string[],
  flags = { cinema: false, withChild: false }
): Promise<number> {
  let added = 0;
  for (const date of dates) {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season_id: seasonId, start_date: date, end_date: date, cinema: flags.cinema, with_child: flags.withChild }),
      });
      if (res.ok) added++;
    } catch { /* skip */ }
  }
  return added;
}
