import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { sqlite } from "@/db";

export const runtime = "nodejs";

const DB_PATH = process.env.DATABASE_URL ?? join(process.cwd(), "medialog.db");
const COVERS_DIR = join(dirname(DB_PATH), "covers");

type Cover = { title: string; cover_url: string };

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const localFiles: Buffer[] = [];
  const centralDirectory: Buffer[] = [];
  let offset = 0;

  for (const { name, data } of files) {
    const filename = Buffer.from(name);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    localFiles.push(local, filename, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    centralDirectory.push(central, filename);
    offset += local.length + filename.length + data.length;
  }

  const centralSize = centralDirectory.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localFiles, ...centralDirectory, end]);
}

function extension(url: string, contentType?: string | null): string {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("gif")) return ".gif";
  const match = url.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i);
  return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : ".jpg";
}

async function coverData(coverUrl: string): Promise<{ data: Buffer; extension: string }> {
  if (coverUrl.startsWith("/api/covers/") || coverUrl.startsWith("/covers/")) {
    const filename = coverUrl.replace(/^\/(?:api\/)?covers\//, "");
    if (!filename || filename.includes("/") || filename.includes("..")) throw new Error("Nieprawidłowa lokalna okładka");
    return { data: readFileSync(join(COVERS_DIR, filename)), extension: extension(filename) };
  }

  const url = new URL(coverUrl);
  if (url.protocol !== "https:") throw new Error("Okładka musi używać HTTPS");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Nie udało się pobrać okładki (${response.status})`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length === 0 || data.length > 10 * 1024 * 1024) throw new Error("Nieprawidłowy rozmiar okładki");
  return { data, extension: extension(coverUrl, response.headers.get("content-type")) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const seasonIds = [...new Set(
    (searchParams.get("season_ids") ?? "").split(",").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
  )];
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  if (seasonIds.length === 0 || seasonIds.length > 31 || !year || !month) {
    return NextResponse.json({ error: "Nieprawidłowe dane miesiąca" }, { status: 400 });
  }

  try {
    const rows = sqlite.prepare(`
      SELECT m.title, COALESCE(sn.cover_url, m.cover_url) AS cover_url
      FROM seasons sn
      JOIN media m ON m.id = sn.media_id
      WHERE sn.id IN (${seasonIds.map(() => "?").join(",")})
        AND COALESCE(sn.cover_url, m.cover_url) IS NOT NULL
    `).all(...seasonIds) as Cover[];

    const results = await Promise.allSettled(rows.map(async (cover, index) => {
      const { data, extension: ext } = await coverData(cover.cover_url);
      const safeTitle = cover.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "okladka";
      return { name: `${String(index + 1).padStart(2, "0")}-${safeTitle}${ext}`, data };
    }));
    const files = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const failed = results.flatMap((result, index) =>
      result.status === "rejected" ? [`${rows[index].title}: ${result.reason instanceof Error ? result.reason.message : "nieznany błąd"}`] : []
    );
    if (files.length === 0) return NextResponse.json({ error: "Brak okładek do pobrania" }, { status: 404 });
    if (failed.length > 0) {
      files.push({ name: "brakujace-okladki.txt", data: Buffer.from(failed.join("\n")) });
    }

    return new NextResponse(Uint8Array.from(zip(files)).buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="okladki-${year}-${month.padStart(2, "0")}.zip"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Nie udało się przygotować archiwum okładek" }, { status: 502 });
  }
}
