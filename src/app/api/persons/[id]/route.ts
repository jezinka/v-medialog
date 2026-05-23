import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

interface PersonRow {
  id: number;
  name: string;
  photo_url: string | null;
  tmdb_id: number | null;
}

interface MediaRow {
  media_id: number;
  title: string;
  media_type: string;
  cover_url: string | null;
  release_year: number | null;
  role: string;
  character_name: string | null;
  watch_dates: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const personId = Number(id);

    if (isNaN(personId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const person = sqlite
      .prepare(`SELECT id, name, photo_url, tmdb_id FROM persons WHERE id = ?`)
      .get(personId) as PersonRow | undefined;

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const media = sqlite
      .prepare(
        `SELECT m.id as media_id, m.title, m.media_type, m.cover_url, m.release_year,
                mp.role, mp.character_name,
                (SELECT GROUP_CONCAT(DISTINCT s.start_date ORDER BY s.start_date DESC)
                 FROM seasons se JOIN sessions s ON s.season_id = se.id
                 WHERE se.media_id = m.id AND s.start_date IS NOT NULL
                ) as watch_dates
         FROM media_persons mp
         JOIN media m ON m.id = mp.media_id
         WHERE mp.person_id = ?
         ORDER BY mp.role, m.release_year DESC NULLS LAST, m.title`
      )
      .all(personId) as MediaRow[];

    return NextResponse.json({ ...person, media });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch person" }, { status: 500 });
  }
}
