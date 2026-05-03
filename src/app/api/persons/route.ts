import { NextResponse } from "next/server";
import { sqlite } from "@/db";

interface PersonRow {
  id: number;
  name: string;
  photo_url: string | null;
  tmdb_id: number | null;
  media_count: number;
  roles: string;
}

export async function GET() {
  try {
    const rows = sqlite
      .prepare(
        `SELECT p.id, p.name, p.photo_url, p.tmdb_id,
                COUNT(DISTINCT mp.media_id) as media_count,
                GROUP_CONCAT(DISTINCT mp.role) as roles
         FROM persons p
         JOIN media_persons mp ON mp.person_id = p.id
         GROUP BY p.id
         ORDER BY media_count DESC, p.name ASC`
      )
      .all() as PersonRow[];

    const result = rows.map((row) => ({
      ...row,
      roles: row.roles ? row.roles.split(",") : [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch persons" }, { status: 500 });
  }
}
