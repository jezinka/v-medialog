import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

const DB_PATH = process.env.DATABASE_URL ?? join(process.cwd(), "medialog.db");
const COVERS_DIR = join(dirname(DB_PATH), "covers");

/**
 * Downloads an image from a remote URL to the local covers directory.
 * Returns the local `/api/covers/...` path, or null on failure.
 * If the URL is already local, it is returned as-is.
 */
export async function downloadCover(url: string): Promise<string | null> {
  if (!url || !url.startsWith("http")) return null;
  if (url.startsWith("/api/covers/") || url.startsWith("/covers/")) return url;

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

    return `/api/covers/${filename}`;
  } catch (err) {
    console.error("[downloadCover] failed for", url, err);
    return null;
  }
}
