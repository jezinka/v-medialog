export async function createSessionForMedia(
  mediaId: number,
  startDate: string,
  endDate: string,
  options?: { removePlaceholder?: boolean }
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

  if (options?.removePlaceholder) {
    await fetch(`/api/seasons/${seasonId}/placeholders`, { method: "DELETE" });
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
