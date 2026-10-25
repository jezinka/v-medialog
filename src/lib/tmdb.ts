const TMDB_TIMEOUT_MS = 10000;

/** Build a TMDB image URL for a given poster/backdrop path and size */
export function tmdbImageUrl(path: string | null | undefined, size: string): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

/** Build a TMDB API URL with api_key, pl-PL language and optional extra params */
export function buildTmdbUrl(endpoint: string, apiKey: string, extra?: Record<string, string>): string {
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "pl-PL");
  for (const [k, v] of Object.entries(extra ?? {})) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

/** Fetch JSON from TMDB with timeout. Returns {ok, data} or {ok: false, status}. */
export async function fetchTmdb<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TMDB_TIMEOUT_MS) });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as T };
}

/** Returns true if the error is a fetch timeout (AbortError / TimeoutError) */
export function isTmdbTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

export type TmdbCandidate = {
  tmdb_id: number;
  name: string;
  first_air_date: string;
  poster_path: string | null;
};

type TmdbSearchResult = { id: number; name?: string; title?: string; first_air_date?: string; release_date?: string; poster_path?: string | null };

/** First five search hits, shaped for the "pick the right one" list */
export function tmdbCandidates(results: TmdbSearchResult[]): TmdbCandidate[] {
  return results.slice(0, 5).map((r) => ({
    tmdb_id: r.id,
    name: r.name ?? r.title ?? "",
    first_air_date: r.first_air_date ?? r.release_date ?? "",
    poster_path: tmdbImageUrl(r.poster_path, "w92"),
  }));
}

export type TmdbPerson = {
  name: string;
  role: string;
  character_name?: string;
  display_order: number;
  photo_url?: string | null;
  tmdb_id?: number | null;
};

/** People from a TMDB details response (with credits): top 12 actors, plus the director (movie) or creators (TV) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tmdbPersons(d: any, isTv: boolean): TmdbPerson[] {
  const cast = (d.credits?.cast ?? []) as Array<{ id?: number; name: string; character: string; profile_path?: string | null }>;
  const persons: TmdbPerson[] = cast.slice(0, 12).map((c, i) => ({
    name: c.name,
    role: "actor",
    character_name: c.character,
    display_order: i,
    photo_url: tmdbImageUrl(c.profile_path, "w45"),
    tmdb_id: c.id ?? null,
  }));
  if (!isTv) {
    const director = ((d.credits?.crew ?? []) as Array<{ name: string; job: string }>).find((c) => c.job === "Director");
    if (director) persons.push({ name: director.name, role: "director", display_order: 0 });
  } else {
    const createdBy = (d.created_by ?? []) as Array<{ name: string }>;
    persons.push(...createdBy.map((c, i) => ({ name: c.name, role: "creator", display_order: i })));
  }
  return persons;
}
