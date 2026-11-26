import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByPlatform, groupSeasonsByMedia } from "./watchlist.ts";

test("groupSeasonsByMedia keeps media order and sorts seasons, unnumbered last", () => {
  const groups = groupSeasonsByMedia([
    { media_id: 2, season_number: 4, id: "a" },
    { media_id: 1, season_number: null, id: "b" },
    { media_id: 2, season_number: 3, id: "c" },
    { media_id: 1, season_number: 2, id: "d" },
  ]);
  assert.deepEqual(groups.map((g) => [g.media_id, g.seasons.map((s) => s.id)]), [[2, ["c", "a"]], [1, ["d", "b"]]]);
});

test("groupByPlatform lists each item once, under its most common platform; unavailable last", () => {
  const platforms: Record<string, string[]> = { a: ["Netflix", "Max"], b: ["Max"], c: [], d: ["Disney+"], e: ["Netflix", "Disney+"] };
  const groups = groupByPlatform(["a", "b", "c", "d", "e"], (id) => platforms[id]);
  // counts: Disney+ 2, Max 2, Netflix 2 → ties by name; Netflix ends up empty and is dropped
  assert.deepEqual(groups.map((g) => [g.platform, g.items]), [
    ["Disney+", ["d", "e"]],
    ["Max", ["a", "b"]],
    [null, ["c"]],
  ]);
});
