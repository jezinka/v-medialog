import { test } from "node:test";
import assert from "node:assert/strict";
import { partNo } from "./part-number.ts";

test("partNo skips specials when numbering unnumbered parts", () => {
  // Euphoria as watched: S1, specials, S2, S3 — only specials numbered
  const parts = [{ season_number: null }, { season_number: 0 }, { season_number: null }, { season_number: null }];
  assert.deepEqual(parts.map((_, i) => partNo(parts, i)), ["1", "Sp.", "2", "3"]);
  assert.equal(partNo([{ season_number: 5 }], 0), "5");
});

test("partNo treats part 0 as an ordinary volume without specials", () => {
  const vols = [{ season_number: 0 }, { season_number: null }];
  assert.deepEqual(vols.map((_, i) => partNo(vols, i, false)), ["0", "2"]);
});
