import { NextResponse } from "next/server";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    const allTags = db.select().from(tags).orderBy(asc(tags.name)).all();
    return NextResponse.json(allTags);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}
