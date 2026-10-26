import { test } from "node:test";
import assert from "node:assert/strict";
import { NEW_SERIES_NETWORKS, NEW_SERIES_PLATFORMS, discoverFilters, parseNewSeriesInput, parseTmdbId, toNewSeriesItems } from "./new-series.ts";

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

test("toNewSeriesItems falls back to the English overview only when the Polish one is missing", () => {
  const items = toNewSeriesItems([
    { id: 1, name: "Ciało", first_air_date: "2026-11-11", overview: "Po polsku" },
    { id: 2, name: "Honey", first_air_date: "2026-11-14", overview: "" },
    { id: 3, name: "Bez opisu", first_air_date: "2026-11-15" },
  ], new Map(), new Map([[1, "In English"], [2, "Also English"]]));
  assert.deepEqual(items.map((i) => i.overview), ["Po polsku", "Also English", ""]);
});

test("toNewSeriesItems marks ignored shows", () => {
  const items = toNewSeriesItems([
    { id: 1, name: "A", first_air_date: "2026-11-11" },
    { id: 2, name: "B", first_air_date: "2026-11-12" },
  ], new Map(), new Map(), new Set([2]));
  assert.deepEqual(items.map((i) => i.ignored), [false, true]);
});

test("discoverFilters narrows to one country and every network of a platform", () => {
  assert.deepEqual(discoverFilters(null, null), {
    with_origin_country: "PL|US|GB",
    with_networks: Object.keys(NEW_SERIES_NETWORKS).join("|"),
  });
  const networks = (country: string | null, platform: string | null) => discoverFilters(country, platform)?.with_networks.split("|").sort();
  assert.equal(discoverFilters("PL", "TVP")?.with_origin_country, "PL");
  assert.deepEqual(networks("PL", "TVP"), ["483", "5892"]);
  assert.deepEqual(networks("", "Disney+"), ["2739", "453", "88"]);
  assert.equal(discoverFilters("FR", null), null);
  assert.equal(discoverFilters(null, "Hulu"), null);
  // Producing networks are offered under the Polish platform, not on their own
  for (const name of ["Hulu", "FX", "HBO", "Max", "Paramount+", "Peacock"]) assert.ok(!NEW_SERIES_PLATFORMS.includes(name), name);
});

test("parseTmdbId accepts only positive integers", () => {
  assert.equal(parseTmdbId({ tmdb_id: 42 }), 42);
  for (const body of [null, {}, { tmdb_id: 0 }, { tmdb_id: -1 }, { tmdb_id: 1.5 }, { tmdb_id: "42" }]) {
    assert.equal(parseTmdbId(body), null);
  }
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

test("toNewSeriesItems gives a rating only once someone voted", () => {
  const items = toNewSeriesItems([
    { id: 1, name: "A", first_air_date: "2026-11-01", vote_average: 7.4, vote_count: 12 },
    { id: 2, name: "B", first_air_date: "2026-11-02", vote_average: 0, vote_count: 0 },
    { id: 3, name: "C", first_air_date: "2026-11-03" },
  ], new Map());
  assert.deepEqual(items.map((i) => i.rating), [{ average: 7.4, count: 12 }, null, null]);
});
