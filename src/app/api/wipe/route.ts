import { NextResponse } from "next/server";
import { sqlite } from "@/db";
import { readdirSync, unlinkSync, existsSync } from "fs";
import { join, dirname } from "path";

const DB_PATH = process.env.DATABASE_URL ?? join(process.cwd(), "medialog.db");
const COVERS_DIR = join(dirname(DB_PATH), "covers");

export async function POST() {
  try {
    sqlite.pragma("foreign_keys = OFF");
    sqlite.exec(`
      DELETE FROM sessions;
      DELETE FROM media_persons;
      DELETE FROM media_tags;
      DELETE FROM seasons;
      DELETE FROM media;
      DELETE FROM persons;
      DELETE FROM tags;
      DELETE FROM universes;
      DELETE FROM wishlist;
      DELETE FROM reading_list_items;
      DELETE FROM reading_lists;
      DELETE FROM sqlite_sequence WHERE name IN (
        'sessions','media_persons','seasons','media','persons','tags','universes','wishlist','reading_list_items','reading_lists'
      );
    `);
    sqlite.pragma("foreign_keys = ON");

    let deletedCovers = 0;
    if (existsSync(COVERS_DIR)) {
      for (const file of readdirSync(COVERS_DIR)) {
        try {
          unlinkSync(join(COVERS_DIR, file));
          deletedCovers++;
        } catch { /* skip locked files */ }
      }
    }

    return NextResponse.json({ ok: true, deletedCovers });
  } catch (error) {
    console.error("Wipe error:", error);
    return NextResponse.json({ error: "Wipe failed" }, { status: 500 });
  }
}
