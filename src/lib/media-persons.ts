import { sqlite } from "@/db";

export type PersonInput = {
  name: string;
  role: string;
  character_name?: string;
  display_order?: number;
  photo_url?: string | null;
  tmdb_id?: number | null;
  ol_author_key?: string | null;
};

/**
 * Replaces the media's people. Each person is matched by tmdb_id, then by name, otherwise created;
 * known photo and ids are kept when the new data has none. A row matched by tmdb_id keeps its name when
 * another row (a duplicate of the person) already has the new one. Call inside a transaction.
 */
export function replaceMediaPersons(mediaId: number, persons: PersonInput[]) {
  sqlite.prepare(`DELETE FROM media_persons WHERE media_id=?`).run(mediaId);

  for (const p of persons) {
    if (!p.name || !p.role) continue;
    let personId: number | null = null;

    if (p.tmdb_id) {
      const found = sqlite.prepare(`SELECT id FROM persons WHERE tmdb_id=?`).get(p.tmdb_id) as { id: number } | undefined;
      if (found) {
        sqlite.prepare(`UPDATE persons SET
            name=CASE WHEN EXISTS (SELECT 1 FROM persons WHERE name=? AND id<>?) THEN name ELSE ? END,
            photo_url=COALESCE(?,photo_url), ol_author_key=COALESCE(?,ol_author_key) WHERE id=?`)
          .run(p.name, found.id, p.name, p.photo_url ?? null, p.ol_author_key ?? null, found.id);
        personId = found.id;
      }
    }
    if (!personId) {
      const found = sqlite.prepare(`SELECT id FROM persons WHERE name=?`).get(p.name) as { id: number } | undefined;
      if (found) {
        // tmdb_id is free here: a row holding it would have matched above
        sqlite.prepare(`UPDATE persons SET photo_url=COALESCE(?,photo_url), tmdb_id=COALESCE(?,tmdb_id), ol_author_key=COALESCE(?,ol_author_key) WHERE id=?`)
          .run(p.photo_url ?? null, p.tmdb_id ?? null, p.ol_author_key ?? null, found.id);
        personId = found.id;
      }
    }
    if (!personId) {
      const result = sqlite.prepare(`INSERT INTO persons (name, photo_url, tmdb_id, ol_author_key) VALUES (?,?,?,?)`)
        .run(p.name, p.photo_url ?? null, p.tmdb_id ?? null, p.ol_author_key ?? null);
      personId = result.lastInsertRowid as number;
    }
    sqlite.prepare(`INSERT INTO media_persons (media_id, person_id, role, character_name, display_order) VALUES (?,?,?,?,?)`)
      .run(mediaId, personId, p.role, p.character_name ?? null, p.display_order ?? 0);
  }
}
