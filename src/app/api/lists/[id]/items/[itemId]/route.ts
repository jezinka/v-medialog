import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { parseId, badRequest, serverError } from "@/lib/api-helpers";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { itemId } = await params;
    const parsedItemId = parseId(itemId);
    if (parsedItemId == null) return badRequest("Invalid itemId");
    sqlite.prepare("DELETE FROM reading_list_items WHERE id=?").run(parsedItemId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return serverError("Failed to delete item");
  }
}
