import { test } from "node:test";
import assert from "node:assert/strict";
import { toNewSeriesItems } from "./new-series.ts";

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
