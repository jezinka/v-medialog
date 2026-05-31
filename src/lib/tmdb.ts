export const TMDB_TIMEOUT_MS = 10000;

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
