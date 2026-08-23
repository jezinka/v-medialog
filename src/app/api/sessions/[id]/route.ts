import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { badRequest, notFound, serverError, parseRouteId } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    const session = sqlite.prepare(`SELECT * FROM sessions WHERE id=?`).get(id);
    if (!session) return notFound();
    return NextResponse.json(session);
  } catch (error) {
    console.error(error);
    return serverError("Failed to fetch session");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    const { start_date, end_date, cinema, with_child, season_id } = await request.json();
    if (!start_date) return badRequest("start_date is required");
    if (end_date && end_date < start_date) {
      return badRequest("Data końca nie może być wcześniej niż data początku");
    }

    const fields: string[] = ["start_date=?", "end_date=?"];
    const values: unknown[] = [start_date, end_date ?? null];
    if (cinema !== undefined) {
      fields.push("cinema=?");
      values.push(cinema ? 1 : 0);
    }
    if (with_child !== undefined) {
      fields.push("with_child=?");
      values.push(with_child ? 1 : 0);
    }
    if (season_id !== undefined) {
      fields.push("season_id=?");
      values.push(season_id);
    }
    values.push(id);

    sqlite.prepare(`UPDATE sessions SET ${fields.join(", ")} WHERE id=?`).run(...values);

    return NextResponse.json(sqlite.prepare(`SELECT * FROM sessions WHERE id=?`).get(id));
  } catch (error) {
    console.error(error);
    return serverError("Failed to update session");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    sqlite.prepare(`DELETE FROM sessions WHERE id=?`).run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return serverError("Failed to delete session");
  }
}
