import { NextResponse } from "next/server";
import { sqlite } from "@/db";

interface MediaRow {
  id: number;
  title: string;
  media_type: string;
  cover_url: string | null;
  season_count: number;
}

export interface SuggestionGroup {
  base_name: string;
  items: Array<{
    id: number;
    title: string;
    media_type: string;
    cover_url: string | null;
    season_count: number;
  }>;
}

/** Compute canonical "base name" for grouping:
 *  - strip trailing volume/part/season indicators
 *  - strip trailing numbers
 *  - lowercase, trim
 */
function baseName(title: string): string {
  let n = title.trim();
  // Remove trailing: Tom/Część/Part/Vol/Volume/Sezon/Season/Book/Ep + number (with optional punctuation/separator)
  n = n.replace(/[\s\-–:]+(?:część|part|vol\.?|volume|tom|sezon|season|book|ep\.?|episode|#)\s*\d+.*$/i, "");
  // Remove standalone trailing number (e.g. "Matrix 2" or "Matrix II")
  n = n.replace(/[\s\-–:]+(?:\d+|[IVXivx]{1,5})\.?\s*$/, "");
  // Remove trailing colon/dash (e.g. "Harry Potter: ")
  n = n.replace(/[\s:\-–]+$/, "").trim();
  return n.toLowerCase();
}

export async function GET() {
  try {
    const media = sqlite.prepare(`
      SELECT m.id, m.title, m.media_type, m.cover_url,
             COUNT(DISTINCT s.id) as season_count
      FROM media m
      LEFT JOIN seasons s ON s.media_id = m.id
      GROUP BY m.id
      ORDER BY m.title
    `).all() as MediaRow[];

    // Group media by (base_name, media_type)
    const groups = new Map<string, MediaRow[]>();
    for (const item of media) {
      const key = `${baseName(item.title)}::${item.media_type}`;
      if (!key || key.length < 3) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const suggestions: SuggestionGroup[] = [];

    for (const [key, items] of groups) {
      if (items.length < 2) continue;
      const base = key.split("::")[0];

      suggestions.push({
        base_name: base,
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          media_type: i.media_type,
          cover_url: i.cover_url,
          season_count: i.season_count,
        })),
      });
    }

    // Sort by number of items desc
    suggestions.sort((a, b) => b.items.length - a.items.length);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to compute suggestions" }, { status: 500 });
  }
}
