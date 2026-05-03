import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { itemId } = await params;
    sqlite.prepare("DELETE FROM reading_list_items WHERE id=?").run(parseInt(itemId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
