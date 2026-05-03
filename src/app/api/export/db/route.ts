import { NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * GET /api/export/db
 * Zwraca kopię bazy danych SQLite jako plik do pobrania.
 * Używa sqlite.serialize() żeby uzyskać spójny snapshot bez ryzyka race-condition z WAL.
 */
export async function GET() {
  try {
    const buffer = sqlite.serialize();
    const body = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(body.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="medialog-${date}.db"`,
        "Content-Length": String(body.byteLength),
      },
    });
  } catch (error) {
    console.error("DB export error:", error);
    return NextResponse.json({ error: "Nie udało się wyeksportować bazy danych" }, { status: 500 });
  }
}

