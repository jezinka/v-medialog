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

test("groupByPlatform lists items under each platform, biggest first, unavailable last", () => {
  const platforms: Record<string, string[]> = { a: ["Netflix", "Max"], b: ["Max"], c: [], d: ["Disney+"] };
  const groups = groupByPlatform(["a", "b", "c", "d"], (id) => platforms[id]);
  assert.deepEqual(groups.map((g) => [g.platform, g.items]), [
    ["Max", ["a", "b"]],
    ["Disney+", ["d"]],
    ["Netflix", ["a"]],
    [null, ["c"]],
  ]);
});
