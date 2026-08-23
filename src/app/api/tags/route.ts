import { NextResponse } from "next/server";
import { sqlite } from "@/db";
import { serverError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const allTags = sqlite.prepare("SELECT id, name, created_at FROM tags ORDER BY name ASC").all();
    return NextResponse.json(allTags);
  } catch (error) {
    console.error(error);
    return serverError("Failed to fetch tags");
  }
}
