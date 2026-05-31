import { NextResponse } from "next/server";

export const VALID_WISHLIST_MEDIA_TYPES = ["book", "comic", "movie", "series", "anime", "cartoon"] as const;

/** Parse the numeric id from dynamic route params */
export async function parseRouteId(params: Promise<{ id: string }>): Promise<number> {
  const { id } = await params;
  return parseInt(id, 10);
}

/** Return a JSON error response */
export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Safely parse a JSON string, returning null on failure */
export function safeJsonParse<T>(str: string | null | undefined): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}
