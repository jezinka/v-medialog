/**
 * Display number of a season/part in a list ordered by watch date.
 * With `specials` (TV), season 0 shows as "Sp." and doesn't shift the position-based numbers
 * of unnumbered parts; without it (books, manga) part 0 is an ordinary volume.
 */
export function partNo(parts: { season_number: number | null }[], idx: number, specials = true): string {
  const p = parts[idx];
  if (specials && p.season_number === 0) return "Sp.";
  return String(p.season_number ?? parts.slice(0, idx).filter((x) => !specials || x.season_number !== 0).length + 1);
}
