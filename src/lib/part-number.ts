/**
 * Display number of a season/part in a list ordered by watch date.
 * With `specials` (screen media, TMDB), season 0 shows as "Sp." and doesn't shift the position-based numbers
 * of unnumbered parts; without it (books, manga, podcasts, records) part 0 is an ordinary volume.
 */
export function partNo(parts: { season_number: number | null }[], idx: number, specials = true): string {
  const p = parts[idx];
  if (specials && p.season_number === 0) return "Sp.";
  return String(p.season_number ?? parts.slice(0, idx).filter((x) => !specials || x.season_number !== 0).length + 1);
}

/** Readable name of a part: specials, "<label> N", its title, or the computed number `no`. */
export function seasonLabel(s: { season_number: number | null; title: string | null }, no: string, label = "Sezon"): string {
  if (no === "Sp.") return s.title ? `${s.title} (Speciale)` : "Speciale";
  if (s.season_number != null) return s.title ? `${s.title} (${s.season_number})` : `${label} ${s.season_number}`;
  if (s.title) return `${s.title} (${no})`;
  return no;
}
