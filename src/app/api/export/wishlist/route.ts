import { NextResponse } from "next/server";
import { sqlite } from "@/db";
import { CALENDAR_TYPES } from "@/lib/utils";

function escapeCSVField(value: string | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  try {
    const rows = sqlite
      .prepare(
        // priority kept as a constant so the CSV stays importable by older versions
        `SELECT m.title, m.author, m.media_type, 'normal' AS priority, m.notes, m.cover_url, m.release_year
         FROM media m
         WHERE m.media_type IN (${CALENDAR_TYPES.map(() => "?").join(",")})
           AND EXISTS (SELECT 1 FROM seasons s WHERE s.media_id = m.id AND s.want_to_watch = 1)
         ORDER BY m.title`
      )
      .all(...CALENDAR_TYPES) as {
      title: string;
      author: string | null;
      media_type: string;
      priority: string;
      notes: string | null;
      cover_url: string | null;
      release_year: number | null;
    }[];

    const header = "title,author,media_type,priority,notes,cover_url,release_year\r\n";
    const lines = rows.map((r) =>
      [
        escapeCSVField(r.title),
        escapeCSVField(r.author),
        escapeCSVField(r.media_type),
        escapeCSVField(r.priority),
        escapeCSVField(r.notes),
        escapeCSVField(r.cover_url),
        escapeCSVField(r.release_year == null ? null : String(r.release_year)),
      ].join(",")
    );

    const csv = header + lines.join("\r\n");
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wishlist-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
