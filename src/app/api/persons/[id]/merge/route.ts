import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const targetId = Number(id);
    if (isNaN(targetId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json() as { sourceId?: number };
    const sourceId = Number(body.sourceId);
    if (isNaN(sourceId) || !sourceId) {
      return NextResponse.json({ error: "sourceId required" }, { status: 400 });
    }
    if (sourceId === targetId) {
      return NextResponse.json({ error: "Cannot merge person with itself" }, { status: 400 });
    }

    const merge = sqlite.transaction(() => {
      // Move media_persons: reassign sourceId → targetId, skip duplicates
      const existingTargetMedia = (
        sqlite.prepare(`SELECT media_id, role FROM media_persons WHERE person_id = ?`).all(targetId) as Array<{ media_id: number; role: string }>
      );
      const targetSet = new Set(existingTargetMedia.map((r) => `${r.media_id}:${r.role}`));

      const sourceMedia = sqlite
        .prepare(`SELECT media_id, role, character_name FROM media_persons WHERE person_id = ?`)
        .all(sourceId) as Array<{ media_id: number; role: string; character_name: string | null }>;

      for (const row of sourceMedia) {
        const key = `${row.media_id}:${row.role}`;
        if (!targetSet.has(key)) {
          sqlite
            .prepare(`INSERT INTO media_persons (person_id, media_id, role, character_name) VALUES (?, ?, ?, ?)`)
            .run(targetId, row.media_id, row.role, row.character_name);
        }
      }

      // Delete source person's old links, then delete person
      sqlite.prepare(`DELETE FROM media_persons WHERE person_id = ?`).run(sourceId);
      sqlite.prepare(`DELETE FROM persons WHERE id = ?`).run(sourceId);
    });

    merge();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Merge failed" }, { status: 500 });
  }
}
