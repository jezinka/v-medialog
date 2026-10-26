import { NextRequest, NextResponse } from "next/server";
import { saveCover } from "@/lib/covers";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export async function POST(request: NextRequest) {
  try {
    // Accept JSON body with base64-encoded image to avoid multipart/formData
    // parsing issues (ECONNRESET) in Next.js standalone server.
    const { data, type } = await request.json() as { data: string; type: string };

    if (!data || !type) return NextResponse.json({ error: "Brak danych" }, { status: 400 });

    const ext = ALLOWED_TYPES[type];
    if (!ext) {
      return NextResponse.json({ error: "Nieobsługiwany format (jpg/png/webp)" }, { status: 400 });
    }

    const buffer = Buffer.from(data, "base64");
    if (buffer.length === 0) return NextResponse.json({ error: "Pusty plik" }, { status: 400 });

    return NextResponse.json({ path: saveCover(buffer, ext) });
  } catch (err) {
    console.error("Cover upload error:", err);
    return NextResponse.json({ error: "Błąd uploadu" }, { status: 500 });
  }
}
