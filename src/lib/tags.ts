import { db, sqlite } from "@/db";
import { tags, mediaTags } from "@/db/schema";

export function parseTagsInput(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : input.split(",");
  return arr.map((t) => t.trim().toLowerCase()).filter(Boolean);
}

export function getMediaTags(mediaId: number): { id: number; name: string }[] {
  const rows = sqlite.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN media_tags mt ON mt.tag_id = t.id
    WHERE mt.media_id = ?
    ORDER BY t.name
  `).all(mediaId) as { id: number; name: string }[];
  return rows;
}

export function setMediaTags(mediaId: number, tagNames: string[]): void {
  sqlite.prepare("DELETE FROM media_tags WHERE media_id = ?").run(mediaId);
  
  for (const name of tagNames) {
    if (!name) continue;
    const normalized = name.trim().toLowerCase();
    
    let tag = sqlite.prepare("SELECT id FROM tags WHERE name = ?").get(normalized) as { id: number } | undefined;
    if (!tag) {
      const result = sqlite.prepare("INSERT INTO tags (name) VALUES (?)").run(normalized);
      tag = { id: result.lastInsertRowid as number };
    }
    
    sqlite.prepare("INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)").run(mediaId, tag.id);
  }
}
