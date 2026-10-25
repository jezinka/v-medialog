import { test } from "node:test";
import assert from "node:assert/strict";
import { tmdbCandidates, tmdbPersons } from "./tmdb.ts";
import { itunesGenres, toItunesCandidate } from "./itunes.ts";

test("tmdbPersons: movie → actors with ids + director, TV → creators", () => {
  const credits = {
    cast: [{ id: 7, name: "A", character: "X", profile_path: "/a.jpg" }, { name: "B", character: "Y" }],
    crew: [{ name: "C", job: "Writer" }, { name: "D", job: "Director" }],
  };
  assert.deepEqual(tmdbPersons({ credits }, false), [
    { name: "A", role: "actor", character_name: "X", display_order: 0, photo_url: "https://image.tmdb.org/t/p/w45/a.jpg", tmdb_id: 7 },
    { name: "B", role: "actor", character_name: "Y", display_order: 1, photo_url: null, tmdb_id: null },
    { name: "D", role: "director", display_order: 0 },
  ]);
  const tv = tmdbPersons({ credits, created_by: [{ name: "E" }] }, true);
  assert.deepEqual(tv.map((p) => [p.name, p.role]), [["A", "actor"], ["B", "actor"], ["E", "creator"]]);
});

test("tmdbCandidates keeps five, falls back to movie fields", () => {
  const results = Array.from({ length: 7 }, (_, i) => ({ id: i, title: `M${i}`, release_date: "2020-01-01", poster_path: null }));
  const c = tmdbCandidates(results);
  assert.equal(c.length, 5);
  assert.deepEqual(c[0], { tmdb_id: 0, name: "M0", first_air_date: "2020-01-01", poster_path: null });
});

test("iTunes candidate uses the 600px cover and drops catch-all genres", () => {
  const item = { collectionId: 5, collectionName: "Album", artistName: "Band", releaseDate: "2019-05-01T00:00:00Z", artworkUrl100: "https://x/100x100bb.jpg", genres: ["Rock", "Music"] };
  assert.deepEqual(toItunesCandidate(item), { itunes_id: 5, title: "Album", artist: "Band", year: 2019, cover_url: "https://x/600x600bb.jpg" });
  assert.deepEqual(itunesGenres(item), ["Rock"]);
  assert.deepEqual(itunesGenres({ primaryGenreName: "Podcast" }), []);
});
