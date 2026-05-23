import { NextResponse } from "next/server";
import { sqlite } from "@/db";

interface PersonRow {
  id: number;
  name: string;
  photo_url: string | null;
  tmdb_id: number | null;
  media_count: number;
  roles: string | null;
}

export async function GET() {
  try {
    const rows = sqlite
      .prepare(
        `SELECT p.id, p.name, p.photo_url, p.tmdb_id,
                COUNT(DISTINCT CASE WHEN mp.role != 'yt_channel' THEN mp.media_id END) as media_count,
                GROUP_CONCAT(DISTINCT mp.role) as roles
         FROM persons p
         LEFT JOIN media_persons mp ON mp.person_id = p.id
         GROUP BY p.id
         HAVING COUNT(DISTINCT CASE WHEN mp.role != 'yt_channel' THEN mp.media_id END) > 0
         ORDER BY media_count DESC, p.name ASC`
      )
      .all() as PersonRow[];

    const result = rows.map((row) => {
      const roles = (row.roles ? row.roles.split(",") : []).filter((r) => r !== "yt_channel");
      return { ...row, roles };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch persons" }, { status: 500 });
  }
}
