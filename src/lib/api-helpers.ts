import { NextResponse } from "next/server";
import { CALENDAR_TYPES } from "@/lib/utils";

export const VALID_WISHLIST_MEDIA_TYPES = CALENDAR_TYPES;

/** Parse the numeric id from dynamic route params */
export async function parseRouteId(params: Promise<{ id: string }>): Promise<number> {
  const { id } = await params;
  const parsed = parseId(id);
  if (parsed == null) throw new Error("Invalid id");
  return parsed;
}

export function parseId(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Return a JSON error response */
export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export const badRequest = (message: string) => jsonError(message, 400);
export const notFound = (message = "Not found") => jsonError(message, 404);
export const serverError = (message = "Internal server error") => jsonError(message, 500);

/** Safely parse a JSON string, returning null on failure */
export function safeJsonParse<T>(str: string | null | undefined): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}
