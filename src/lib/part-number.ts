/**
 * Display number of a season/part in a list ordered by watch date.
 * Specials (season 0) show as "Sp." and don't shift the position-based numbers of unnumbered parts.
 */
export function partNo(parts: { season_number: number | null }[], idx: number): string {
  const p = parts[idx];
  if (p.season_number === 0) return "Sp.";
  return String(p.season_number ?? parts.slice(0, idx).filter((x) => x.season_number !== 0).length + 1);
}
