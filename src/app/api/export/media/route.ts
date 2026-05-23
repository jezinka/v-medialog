import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

function escapeCSVField(value: string | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const ALL_TYPES = ["book", "comic", "movie", "series", "anime", "cartoon"];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const typesParam = searchParams.get("types");
    const selectedTypes = typesParam
      ? typesParam.split(",").filter((t) => ALL_TYPES.includes(t))
      : ALL_TYPES;

    const placeholders = selectedTypes.map(() => "?").join(",");
    const rows = sqlite.prepare(`
      SELECT
        m.title, m.original_title, m.author, m.media_type, m.cover_url,
        m.tags, m.notes, m.discontinued, m.tmdb_id, m.release_year,
        s.season_number,
        se.start_date, se.end_date, se.cinema
      FROM sessions se
      JOIN seasons s ON se.season_id = s.id
      JOIN media m ON s.media_id = m.id
      WHERE m.media_type IN (${placeholders})
      ORDER BY se.start_date DESC
    `).all(...selectedTypes) as {
      title: string; original_title: string | null; author: string | null; media_type: string;
      cover_url: string | null; tags: string | null; notes: string | null; discontinued: number | null;
      tmdb_id: number | null; release_year: number | null;
      season_number: number | null; start_date: string; end_date: string | null; cinema: number | null;
    }[];

    const header = "title,original_title,author,media_type,season_number,start_date,end_date,tags,notes,discontinued,cover_url,cinema,tmdb_id,release_year\r\n";
    const lines = rows.map((r) =>
      [
        escapeCSVField(r.title), escapeCSVField(r.original_title), escapeCSVField(r.author),
        escapeCSVField(r.media_type), escapeCSVField(r.season_number?.toString()),
        escapeCSVField(r.start_date), escapeCSVField(r.end_date),
        escapeCSVField(r.tags), escapeCSVField(r.notes),
        escapeCSVField(r.discontinued ? "1" : "0"),
        escapeCSVField(r.cover_url), escapeCSVField(r.cinema ? "1" : "0"),
        escapeCSVField(r.tmdb_id?.toString()), escapeCSVField(r.release_year?.toString()),
      ].join(",")
    );

    const csv = header + lines.join("\r\n");
    const date = new Date().toISOString().split("T")[0];
    const suffix = selectedTypes.length === ALL_TYPES.length ? "" : `-${selectedTypes.join("_")}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="medialog${suffix}-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
