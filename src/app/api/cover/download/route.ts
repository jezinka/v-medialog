import { NextRequest, NextResponse } from "next/server";
import { downloadCover } from "@/lib/covers";

export async function POST(request: NextRequest) {
  const { url } = (await request.json()) as { url: string };
  if (!url || !url.startsWith("http")) {
    return NextResponse.json({ error: "Nieprawidłowy URL" }, { status: 400 });
  }
  if (url.startsWith("/api/covers/") || url.startsWith("/covers/")) {
    return NextResponse.json({ path: url.startsWith("/covers/") ? url.replace("/covers/", "/api/covers/") : url });
  }
  const path = await downloadCover(url);
  if (!path) return NextResponse.json({ error: "Błąd pobierania obrazka" }, { status: 502 });
  return NextResponse.json({ path });
}
