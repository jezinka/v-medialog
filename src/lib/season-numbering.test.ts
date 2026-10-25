import { test } from "node:test";
import assert from "node:assert/strict";
import { planSeasonNumbers } from "./season-numbering.ts";

test("planSeasonNumbers", () => {
  // Euphoria as watched: S1, specials, S2, S3
  assert.deepEqual(
    planSeasonNumbers([{ id: 1, season_number: null }, { id: 2, season_number: 0 }, { id: 3, season_number: null }, { id: 4, season_number: null }], true),
    [{ id: 1, season_number: 1 }, { id: 3, season_number: 2 }, { id: 4, season_number: 3 }]
  );
  // books: part 0 is an ordinary volume
  assert.deepEqual(planSeasonNumbers([{ id: 1, season_number: 0 }, { id: 2, season_number: null }], false), [{ id: 2, season_number: 2 }]);
  // already numbered seasons keep their slot
  assert.deepEqual(planSeasonNumbers([{ id: 1, season_number: 1 }, { id: 2, season_number: null }], true), [{ id: 2, season_number: 2 }]);
  // clash with an existing number → manual fix
  assert.equal(planSeasonNumbers([{ id: 1, season_number: null }, { id: 2, season_number: 1 }], true), null);
});
