import { NextResponse } from "next/server";
import { sqlite } from "@/db";
import { readdirSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { COVERS_DIR } from "@/lib/covers";


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
      DELETE FROM sqlite_sequence WHERE name IN (
        'sessions','media_persons','seasons','media','persons','tags','universes'
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
