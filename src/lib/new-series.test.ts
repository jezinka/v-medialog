import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNewSeriesInput, toNewSeriesItems } from "./new-series.ts";

test("toNewSeriesItems keeps dated shows once and links library ones", () => {
  const items = toNewSeriesItems([
    { id: 1, name: "Ciało", original_name: "Body", first_air_date: "2026-11-11", origin_country: ["US"], poster_path: "/p.jpg" },
    { id: 2, name: "", original_name: "Honey", first_air_date: "2026-11-14" },
    { id: 1, name: "Ciało", first_air_date: "2026-11-11" },
    { id: 3, name: "No date" },
  ], new Map([[2, 77]]));
  assert.deepEqual(items.map((i) => [i.tmdb_id, i.title, i.media_id]), [[1, "Ciało", null], [2, "Honey", 77]]);
  assert.equal(items[0].poster_url, "https://image.tmdb.org/t/p/w185/p.jpg");
  assert.equal(items[1].poster_url, null);
});

test("parseNewSeriesInput rejects bad bodies", () => {
  const ok = { tmdb_id: 5, title: " Ciało ", first_air_date: "2026-11-11", poster_url: null };
  assert.deepEqual(parseNewSeriesInput(ok), { tmdb_id: 5, title: "Ciało", original_title: null, poster_url: null, first_air_date: "2026-11-11" });
  assert.equal(parseNewSeriesInput({ ...ok, first_air_date: "2026-13-45" }), null);
  assert.equal(parseNewSeriesInput({ ...ok, first_air_date: "2026-02-30" }), null);
  assert.equal(parseNewSeriesInput({ ...ok, title: 7 }), null);
  assert.equal(parseNewSeriesInput({ ...ok, poster_url: {} }), null);
  assert.equal(parseNewSeriesInput({ ...ok, tmdb_id: "5" }), null);
  assert.equal(parseNewSeriesInput(null), null);
});
