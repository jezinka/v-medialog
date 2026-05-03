import { NextResponse } from "next/server";
import { sqlite } from "@/db";

function escapeCSVField(value: string | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  try {
    // Join media + seasons + sessions for a flat CSV export
    const rows = sqlite.prepare(`
      SELECT
        m.title, m.original_title, m.author, m.media_type, m.cover_url,
        m.tags, m.notes, m.discontinued,
        s.season_number,
        se.start_date, se.end_date, se.cinema
      FROM sessions se
      JOIN seasons s ON se.season_id = s.id
      JOIN media m ON s.media_id = m.id
      ORDER BY se.start_date DESC
    `).all() as {
      title: string; original_title: string | null; author: string | null; media_type: string;
      cover_url: string | null; tags: string | null; notes: string | null; discontinued: number | null;
      season_number: number | null; start_date: string; end_date: string | null; cinema: number | null;
    }[];

    const header = "title,original_title,author,media_type,season_number,start_date,end_date,tags,notes,discontinued,cover_url,cinema\r\n";
    const lines = rows.map((r) =>
      [
        escapeCSVField(r.title), escapeCSVField(r.original_title), escapeCSVField(r.author),
        escapeCSVField(r.media_type), escapeCSVField(r.season_number?.toString()),
        escapeCSVField(r.start_date), escapeCSVField(r.end_date),
        escapeCSVField(r.tags), escapeCSVField(r.notes),
        escapeCSVField(r.discontinued ? "1" : "0"),
        escapeCSVField(r.cover_url), escapeCSVField(r.cinema ? "1" : "0"),
      ].join(",")
    );

    const csv = header + lines.join("\r\n");
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="medialog-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
