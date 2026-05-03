import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    sqlite.prepare("DELETE FROM reading_lists WHERE id=?").run(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
  }
}
