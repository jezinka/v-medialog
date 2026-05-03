import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { parseTagsInput, setMediaTags, getMediaTags } from "@/lib/tags";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = sqlite.prepare(
      `SELECT m.*, u.name as universe_name FROM media m LEFT JOIN universes u ON u.id = m.universe_id WHERE m.id=?`
    ).get(parseInt(id));
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const seasons = sqlite.prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM sessions se WHERE se.season_id = s.id) as session_count
       FROM seasons s WHERE s.media_id=? ORDER BY s.season_number, s.id`
    ).all(parseInt(id));

    return NextResponse.json({ ...item as object, seasons, tagList: getMediaTags(parseInt(id)) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = parseInt(id);
    const body = await request.json();
    const {
      title, original_title, author, media_type, universe_id,
      cover_url, tmdb_id, ol_key, description, genres, vote_average,
      runtime, release_year, external_synced_at,
      tags: tagsInput, notes, discontinued,
    } = body;

    // Build dynamic SET clause — only update fields explicitly provided in body
    const fields: string[] = ["updated_at=datetime('now')"];
    const values: unknown[] = [];

    const optionals: [string, unknown][] = [
      ["title", title],
      ["original_title", original_title],
      ["author", author],
      ["media_type", media_type],
      ["universe_id", universe_id],
      ["cover_url", cover_url],
      ["tmdb_id", tmdb_id],
      ["ol_key", ol_key],
      ["description", description],
      ["genres", genres],
      ["vote_average", vote_average],
      ["runtime", runtime],
      ["release_year", release_year],
      ["external_synced_at", external_synced_at],
      ["tags", tagsInput],
      ["notes", notes],
    ];

    for (const [col, val] of optionals) {
      if (val !== undefined) {
        fields.push(`${col}=?`);
        values.push(val ?? null);
      }
    }

    if (discontinued !== undefined) {
      fields.push("discontinued=?");
      values.push(discontinued ? 1 : 0);
    }

    if (fields.length === 1) {
      // Only updated_at — nothing to update
      const current = sqlite.prepare(`SELECT * FROM media WHERE id=?`).get(numId);
      return NextResponse.json({ ...current as object, tagList: getMediaTags(numId) });
    }

    values.push(numId);
    sqlite.prepare(`UPDATE media SET ${fields.join(", ")} WHERE id=?`).run(...values);

    if (tagsInput !== undefined) setMediaTags(numId, parseTagsInput(tagsInput));

    const updated = sqlite.prepare(`SELECT * FROM media WHERE id=?`).get(numId);
    return NextResponse.json({ ...updated as object, tagList: getMediaTags(numId) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update media" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    sqlite.prepare(`DELETE FROM media WHERE id=?`).run(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete media" }, { status: 500 });
  }
}
