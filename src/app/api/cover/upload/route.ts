import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

const DB_PATH = process.env.DATABASE_URL ?? join(process.cwd(), "medialog.db");
const COVERS_DIR = join(dirname(DB_PATH), "covers");

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

    if (!existsSync(COVERS_DIR)) mkdirSync(COVERS_DIR, { recursive: true });

    const filename = createHash("md5").update(buffer).digest("hex") + ext;
    writeFileSync(join(COVERS_DIR, filename), buffer);

    return NextResponse.json({ path: `/api/covers/${filename}` });
  } catch (err) {
    console.error("Cover upload error:", err);
    return NextResponse.json({ error: "Błąd uploadu" }, { status: 500 });
  }
}
