import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = sqlite.prepare(`SELECT * FROM sessions WHERE id=?`).get(parseInt(id));
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(session);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { start_date, end_date, cinema, season_id } = await request.json();
    if (!start_date) return NextResponse.json({ error: "start_date is required" }, { status: 400 });
    if (end_date && end_date < start_date) {
      return NextResponse.json({ error: "Data końca nie może być wcześniej niż data początku" }, { status: 400 });
    }

    const fields: string[] = ["start_date=?", "end_date=?", "cinema=?"];
    const values: unknown[] = [start_date, end_date ?? null, cinema ? 1 : 0];
    if (season_id !== undefined) {
      fields.push("season_id=?");
      values.push(season_id);
    }
    values.push(parseInt(id));

    sqlite.prepare(`UPDATE sessions SET ${fields.join(", ")} WHERE id=?`).run(...values);

    return NextResponse.json(sqlite.prepare(`SELECT * FROM sessions WHERE id=?`).get(parseInt(id)));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    sqlite.prepare(`DELETE FROM sessions WHERE id=?`).run(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
