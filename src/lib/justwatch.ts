/**
 * JustWatch unofficial GraphQL client for Poland VOD availability.
 * Endpoint: https://apis.justwatch.com/graphql
 */

const JW_API = "https://apis.justwatch.com/graphql";
const JW_ICON_BASE = "https://images.justwatch.com";
const COUNTRY = "PL";

// Media types that have VOD availability
export const VOD_MEDIA_TYPES = ["movie", "series", "anime", "cartoon"];

export interface JwOffer {
  providerName: string;
  providerLogo: string;
  providerSlug: string;
  monetizationType: string; // FLATRATE | BUY | RENT | FREE | ADS
  quality: string; // SD | HD | _4K
  url: string;
  availableFrom: string | null;
  availableTo: string | null;
}

export interface JwResult {
  jwId: string; // e.g. "ts4", "tm92641"
  title: string;
  year: number | null;
  tmdbId: string | null;
  objectType: string; // SHOW | MOVIE
  offers: JwOffer[];
}

const OFFERS_QUERY = `
query SearchVOD($query: String!, $country: Country!) {
  popularTitles(country: $country, first: 5, filter: { searchQuery: $query }) {
    edges {
      node {
        id
        objectType
        content(country: $country, language: "pl") {
          title
          originalReleaseYear
          externalIds { tmdbId }
        }
        offers(country: $country, platform: WEB) {
          monetizationType
          presentationType
          availableFromTime
          availableTo
          standardWebURL
          package {
            clearName
            technicalName
            icon(profile: S100, format: WEBP)
          }
        }
      }
    }
  }
}`;

async function gql(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(JW_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`JustWatch API ${res.status}`);
  const json = await res.json() as { data?: unknown; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

function qualityOrder(q: string) {
  return q === "_4K" ? 3 : q === "HD" ? 2 : 1;
}

/** Deduplicate offers — keep best quality per provider+monetizationType */
function dedupeOffers(raw: {
  monetizationType: string;
  presentationType: string;
  availableFromTime: string | null;
  availableTo: string | null;
  standardWebURL: string;
  package: { clearName: string; technicalName: string; icon: string };
}[]): JwOffer[] {
  const best = new Map<string, JwOffer>();
  for (const o of raw) {
    const key = `${o.package.technicalName}__${o.monetizationType}`;
    const existing = best.get(key);
    if (!existing || qualityOrder(o.presentationType) > qualityOrder(existing.quality)) {
      best.set(key, {
        providerName: o.package.clearName,
        providerLogo: JW_ICON_BASE + o.package.icon,
        providerSlug: o.package.technicalName,
        monetizationType: o.monetizationType,
        quality: o.presentationType,
        url: o.standardWebURL,
        availableFrom: o.availableFromTime ?? null,
        availableTo: o.availableTo ?? null,
      });
    }
  }
  return Array.from(best.values());
}

type JwNode = {
  id: string;
  objectType: string;
  content: {
    title: string;
    originalReleaseYear: number | null;
    externalIds: { tmdbId: string | null };
  };
  offers: {
    monetizationType: string;
    presentationType: string;
    availableFromTime: string | null;
    availableTo: string | null;
    standardWebURL: string;
    package: { clearName: string; technicalName: string; icon: string };
  }[];
};

/**
 * Normalize a title for comparison:
 * lowercase, remove Polish diacritics, strip punctuation, collapse spaces.
 */
function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l") // ł doesn't decompose via NFD
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Jaccard similarity on word sets (words longer than 1 char).
 * Returns 0–1.
 */
function titleSimilarity(a: string, b: string): number {
  const wa = new Set(normTitle(a).split(" ").filter((w) => w.length > 1));
  const wb = new Set(normTitle(b).split(" ").filter((w) => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;
  const intersection = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return intersection / union;
}

/**
 * Search JustWatch for a title (Polish catalog).
 * Returns the best-matching result with its offers, or null if not found.
 *
 * Matching priority (no result accepted unless it passes a similarity gate):
 *  1. Exact TMDB ID match
 *  2. Exact normalized title match (case/diacritic insensitive)
 *  3. Year + objectType match with title similarity >= 0.4
 *  4. Title similarity >= 0.5 (no year required)
 *
 *  The "first result" fallback is intentionally absent — it caused
 *  unrelated titles to be stored (e.g. "She Monkeys" -> "She Hulk").
 */
export async function searchJustWatch(
  title: string,
  opts: { year?: number | null; tmdbId?: number | null; objectType?: "SHOW" | "MOVIE" } = {}
): Promise<JwResult | null> {
  const data = await gql(OFFERS_QUERY, { query: title, country: COUNTRY }) as {
    popularTitles: { edges: { node: JwNode }[] };
  };

  const nodes = data.popularTitles.edges.map((e) => e.node);
  if (nodes.length === 0) return null;

  let match: JwNode | undefined;

  // 1. Exact TMDB ID match — most reliable
  if (opts.tmdbId) {
    match = nodes.find((n) => n.content.externalIds.tmdbId === String(opts.tmdbId));
  }

  // 2. Exact normalized title match (case/diacritic insensitive)
  if (!match) {
    const normQuery = normTitle(title);
    match = nodes.find((n) => normTitle(n.content.title) === normQuery);
  }

  // 3. Year + objectType match, guarded by title similarity >= 0.4
  if (!match && opts.year) {
    const candidates = nodes.filter(
      (n) =>
        n.content.originalReleaseYear === opts.year &&
        (!opts.objectType || n.objectType === opts.objectType)
    );
    match = candidates.find((n) => titleSimilarity(title, n.content.title) >= 0.4);
  }

  // 4. Title similarity >= 0.5 (no year required)
  if (!match) {
    match = nodes
      .map((n) => ({ node: n, sim: titleSimilarity(title, n.content.title) }))
      .filter((x) => x.sim >= 0.5)
      .sort((a, b) => b.sim - a.sim)[0]?.node;
  }

  if (!match) return null;

  return {
    jwId: match.id,
    title: match.content.title,
    year: match.content.originalReleaseYear,
    tmdbId: match.content.externalIds.tmdbId,
    objectType: match.objectType,
    offers: dedupeOffers(match.offers),
  };
}

/** Map app media_type to JustWatch objectType */
export function toJwObjectType(mediaType: string): "SHOW" | "MOVIE" | undefined {
  if (mediaType === "movie") return "MOVIE";
  if (mediaType === "series" || mediaType === "anime" || mediaType === "cartoon") return "SHOW";
  return undefined;
}
