import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

const DB_PATH = process.env.DATABASE_URL ?? join(process.cwd(), "medialog.db");
const COVERS_DIR = join(dirname(DB_PATH), "covers");

export async function POST(request: NextRequest) {
  const { url } = (await request.json()) as { url: string };
  if (!url || !url.startsWith("http")) {
    return NextResponse.json({ error: "Nieprawidłowy URL" }, { status: 400 });
  }
  // If already a local path, return it as-is
  if (url.startsWith("/api/covers/") || url.startsWith("/covers/")) {
    return NextResponse.json({ path: url.startsWith("/covers/") ? url.replace("/covers/", "/api/covers/") : url });
  }
  try {
    if (!existsSync(COVERS_DIR)) mkdirSync(COVERS_DIR, { recursive: true });

    const ext = url.includes(".png") ? ".png" : url.includes(".webp") ? ".webp" : ".jpg";
    const filename = createHash("md5").update(url).digest("hex") + ext;
    const filepath = join(COVERS_DIR, filename);

    if (!existsSync(filepath)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(filepath, buffer);
    }

    return NextResponse.json({ path: `/api/covers/${filename}` });
  } catch (err) {
    console.error("Cover download error:", err);
    return NextResponse.json({ error: "Błąd pobierania obrazka" }, { status: 502 });
  }
}
