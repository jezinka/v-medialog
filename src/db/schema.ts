import { integer, sqliteTable, text, real, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Universes ────────────────────────────────────────────────────────────────
export const universes = sqliteTable("universes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─── Media ────────────────────────────────────────────────────────────────────
export const media = sqliteTable("media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  universeId: integer("universe_id").references(() => universes.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  author: text("author"),
  mediaType: text("media_type").notNull(),
  coverUrl: text("cover_url"),
  tmdbId: integer("tmdb_id"),
  olKey: text("ol_key"),
  description: text("description"),
  genres: text("genres"),
  voteAverage: real("vote_average"),
  runtime: integer("runtime"),
  releaseYear: integer("release_year"),
  externalSyncedAt: text("external_synced_at"),
  tags: text("tags"),
  notes: text("notes"),
  discontinued: integer("discontinued", { mode: "boolean" }).default(false),
  seriesStatus: text("series_status"),
  tmdbSeasonsCount: integer("tmdb_seasons_count"),
  trackList: text("track_list"),
  sourceUrl: text("source_url"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─── Seasons ──────────────────────────────────────────────────────────────────
export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mediaId: integer("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
  seasonNumber: integer("season_number"),
  title: text("title"),
  coverUrl: text("cover_url"),
  wantToWatch: integer("want_to_watch", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  seasonId: integer("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  cinema: integer("cinema", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─── Tags ─────────────────────────────────────────────────────────────────────
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const mediaTags = sqliteTable("media_tags", {
  mediaId: integer("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => ({
  pk: primaryKey({ columns: [table.mediaId, table.tagId] }),
}));

// ─── Wishlist ─────────────────────────────────────────────────────────────────
export const wishlist = sqliteTable("wishlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  author: text("author"),
  mediaType: text("media_type").notNull(),
  notes: text("notes"),
  priority: text("priority").notNull().default("normal"),
  coverUrl: text("cover_url"),
  addedAt: text("added_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Persons ──────────────────────────────────────────────────────────────────
export const persons = sqliteTable("persons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  photoUrl: text("photo_url"),
  tmdbId: integer("tmdb_id"),
  olAuthorKey: text("ol_author_key"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const mediaPersons = sqliteTable("media_persons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mediaId: integer("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
  personId: integer("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  characterName: text("character_name"),
  displayOrder: integer("display_order").default(0),
});

// ─── Reading lists ────────────────────────────────────────────────────────────
export const readingLists = sqliteTable("reading_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const readingListItems = sqliteTable("reading_list_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id").notNull().references(() => readingLists.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  author: text("author"),
  mediaType: text("media_type").notNull(),
  coverUrl: text("cover_url"),
  mediaId: integer("media_id").references(() => media.id, { onDelete: "set null" }),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type Universe = typeof universes.$inferSelect;
export type NewUniverse = typeof universes.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type Season = typeof seasons.$inferSelect;
export type NewSeason = typeof seasons.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Person = typeof persons.$inferSelect;
export type NewPerson = typeof persons.$inferInsert;
export type MediaPerson = typeof mediaPersons.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type MediaTag = typeof mediaTags.$inferSelect;
export type WishlistItem = typeof wishlist.$inferSelect;
export type NewWishlistItem = typeof wishlist.$inferInsert;
export type ReadingList = typeof readingLists.$inferSelect;
export type NewReadingList = typeof readingLists.$inferInsert;
export type ReadingListItem = typeof readingListItems.$inferSelect;
export type NewReadingListItem = typeof readingListItems.$inferInsert;
