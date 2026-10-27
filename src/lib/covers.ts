import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

const DB_PATH = process.env.DATABASE_URL ?? join(process.cwd(), "medialog.db");
/** Local cover images, next to the database; served as `/api/covers/<file>`. */
export const COVERS_DIR = join(dirname(DB_PATH), "covers");

/** Saves image bytes under a content-hash name and returns the local `/api/covers/...` path. */
export function saveCover(buffer: Buffer, ext: string): string {
  if (!existsSync(COVERS_DIR)) mkdirSync(COVERS_DIR, { recursive: true });
  const filename = createHash("md5").update(buffer).digest("hex") + ext;
  writeFileSync(join(COVERS_DIR, filename), buffer);
  return `/api/covers/${filename}`;
}

/**
 * Downloads an image from a remote URL to the local covers directory.
 * Returns the local `/api/covers/...` path, or null on failure.
 * If the URL is already local, it is returned as-is.
 */
export async function downloadCover(url: string): Promise<string | null> {
  if (url.startsWith("/api/covers/") || url.startsWith("/covers/")) return url;
  if (!url.startsWith("http")) return null;

  try {
    if (!existsSync(COVERS_DIR)) mkdirSync(COVERS_DIR, { recursive: true });

    const ext = url.includes(".png") ? ".png" : url.includes(".webp") ? ".webp" : ".jpg";
    const filename = createHash("md5").update(url).digest("hex") + ext;
    const filepath = join(COVERS_DIR, filename);

    if (!existsSync(filepath)) {
      // Some sites (lubimyczytac.pl) refuse requests without a browser-like User-Agent
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MediaLog/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) throw new Error("Empty image");
      writeFileSync(filepath, buffer);
    }

    return `/api/covers/${filename}`;
  } catch (err) {
    console.error("[downloadCover] failed for", url, err);
    return null;
  }
}
