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
    const rows = sqlite
      .prepare(
        `SELECT title, author, media_type, priority, notes, cover_url
         FROM wishlist ORDER BY added_at DESC`
      )
      .all() as {
      title: string;
      author: string | null;
      media_type: string;
      priority: string;
      notes: string | null;
      cover_url: string | null;
    }[];

    const header = "title,author,media_type,priority,notes,cover_url\r\n";
    const lines = rows.map((r) =>
      [
        escapeCSVField(r.title),
        escapeCSVField(r.author),
        escapeCSVField(r.media_type),
        escapeCSVField(r.priority),
        escapeCSVField(r.notes),
        escapeCSVField(r.cover_url),
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
