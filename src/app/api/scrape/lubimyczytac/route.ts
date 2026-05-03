import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

export interface LubimyczytacData {
  title: string;
  original_title: string | null;
  author: string | null;
  cover_url: string | null;
  description: string | null;
}

const DB_PATH = process.env.DATABASE_URL ?? join(process.cwd(), "medialog.db");
const COVERS_DIR = join(dirname(DB_PATH), "covers");

async function downloadCover(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MediaLog/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    const ext = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : ".jpg";
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) return null;

    if (!existsSync(COVERS_DIR)) mkdirSync(COVERS_DIR, { recursive: true });
    const filename = createHash("md5").update(buffer).digest("hex") + ext;
    writeFileSync(join(COVERS_DIR, filename), buffer);
    return `/api/covers/${filename}`;
  } catch {
    return null;
  }
}

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i");
  const m = re.exec(html) ?? new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i").exec(html);
  return m ? decodeHtmlEntities(m[1]) : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&oacute;/g, "ó")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractBookJsonLd(html: string): Record<string, unknown> | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]) as Record<string, unknown>;
      if (obj["@type"] === "Book") return obj;
    } catch {
      // skip malformed blocks
    }
  }
  return null;
}

function extractOriginalTitle(html: string): string | null {
  const re = /Tytu[łl]\s+oryginalny[\s\S]{0,120}?<dd[^>]*>([\s\S]*?)<\/dd>/i;
  const m = re.exec(html);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, "").trim() || null;
}

export async function POST(req: NextRequest) {
  let url: string;
  try {
    ({ url } = await req.json() as { url: string });
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }

  if (!url || !url.includes("lubimyczytac.pl")) {
    return NextResponse.json({ error: "Podaj link do lubimyczytac.pl" }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MediaLog/1.0)",
        "Accept-Language": "pl,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return NextResponse.json({ error: `Błąd pobierania strony: ${(e as Error).message}` }, { status: 502 });
  }

  const jsonLd = extractBookJsonLd(html);

  const title: string =
    (jsonLd?.["name"] as string | undefined) ||
    extractMeta(html, "og:title")?.split("|")[0].trim() ||
    "";

  if (!title) {
    return NextResponse.json({ error: "Nie znaleziono tytułu na stronie" }, { status: 422 });
  }

  const authorRaw =
    (jsonLd?.["author"] as { name?: string } | undefined)?.name ||
    extractMeta(html, "books:author") ||
    null;

  const externalCoverUrl =
    (jsonLd?.["image"] as string | undefined) ||
    extractMeta(html, "og:image") ||
    null;

  // Download cover locally so it survives if lubimyczytac goes down
  const cover_url = externalCoverUrl ? await downloadCover(externalCoverUrl) : null;

  const description =
    (jsonLd?.["description"] as string | undefined) ||
    extractMeta(html, "og:description") ||
    null;

  const originalTitle = extractOriginalTitle(html);

  const data: LubimyczytacData = {
    title,
    original_title: originalTitle,
    author: authorRaw ?? null,
    cover_url,
    description: description ? description.slice(0, 1000) : null,
  };

  return NextResponse.json(data);
}
