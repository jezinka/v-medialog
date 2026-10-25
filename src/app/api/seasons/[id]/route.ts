import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { badRequest, notFound, parseRouteId, serverError } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    const season = sqlite.prepare(`SELECT * FROM seasons WHERE id=?`).get(id);
    if (!season) return notFound();

    const sessions = sqlite.prepare(
      `SELECT * FROM sessions WHERE season_id=? ORDER BY start_date`
    ).all(id);

    return NextResponse.json({ ...season as object, sessions });
  } catch (error) {
    console.error(error);
    return serverError("Failed to fetch season");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    const body = await request.json() as Record<string, unknown>;
    if (body.want_to_watch !== undefined && typeof body.want_to_watch !== "boolean") {
      return badRequest("want_to_watch must be a boolean");
    }

    // Partial update: only fields present in the body change (e.g. cover-only saves keep season_number/title)
    const fields = (["season_number", "title", "cover_url", "want_to_watch"] as const).filter((f) => f in body);
    if (fields.length > 0) {
      const values = fields.map((f) => f === "want_to_watch" ? (body[f] ? 1 : 0) : (body[f] ?? null));
      sqlite.prepare(`UPDATE seasons SET ${fields.map((f) => `${f}=?`).join(", ")} WHERE id=?`).run(...values, id);
    }

    return NextResponse.json(sqlite.prepare(`SELECT * FROM seasons WHERE id=?`).get(id));
  } catch (error) {
    console.error(error);
    return serverError("Failed to update season");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await parseRouteId(params);
    sqlite.prepare(`DELETE FROM seasons WHERE id=?`).run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return serverError("Failed to delete season");
  }
}
