import { sqlite } from "@/db";

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

/** Tags of many media in one query, keyed by media id; media without tags are absent. */
export function getTagsForMedia(mediaIds: number[]): Map<number, { id: number; name: string }[]> {
  const rows = sqlite.prepare(`
    SELECT mt.media_id, t.id, t.name FROM tags t
    JOIN media_tags mt ON mt.tag_id = t.id
    WHERE mt.media_id IN (SELECT value FROM json_each(?))
    ORDER BY t.name
  `).all(JSON.stringify(mediaIds)) as { media_id: number; id: number; name: string }[];
  const byMedia = new Map<number, { id: number; name: string }[]>();
  for (const { media_id, id, name } of rows) {
    const list = byMedia.get(media_id);
    if (list) list.push({ id, name });
    else byMedia.set(media_id, [{ id, name }]);
  }
  return byMedia;
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
