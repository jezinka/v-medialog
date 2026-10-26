/**
 * Numbers for the unnumbered seasons of one media, given its seasons in display order
 * (by first session date). Matches what partNo used to show: a season's position among
 * regular seasons, with specials (season 0) skipped when `hasSpecials`.
 * Returns null when a number would clash with an existing one — that media needs a manual fix.
 */
export function planSeasonNumbers(
  rows: { id: number; season_number: number | null }[],
  hasSpecials: boolean
): { id: number; season_number: number }[] | null {
  const taken = new Set(rows.map((r) => r.season_number).filter((n) => n != null));
  const plan: { id: number; season_number: number }[] = [];
  let position = 0;
  for (const r of rows) {
    if (hasSpecials && r.season_number === 0) continue;
    position++;
    if (r.season_number != null) continue;
    if (taken.has(position)) return null;
    taken.add(position);
    plan.push({ id: r.id, season_number: position });
  }
  return plan;
}

/**
 * The library season a TMDB season `n` belongs to: by number, else the only season of a one-season show,
 * else the unnumbered season at that position. Specials (season 0) only match season 0.
 */
export function matchDbSeason<S extends { season_number: number | null }>(n: number, numSeasons: number, dbSeasons: S[]): S | null {
  if (n === 0) return dbSeasons.find((s) => s.season_number === 0) ?? null;
  const regular = dbSeasons.filter((s) => s.season_number !== 0);
  return dbSeasons.find((s) => s.season_number === n)
    ?? (numSeasons === 1 && regular.length === 1 ? regular[0] : null)
    ?? (regular.length >= n && regular[n - 1].season_number == null ? regular[n - 1] : null);
}
