import { test } from "node:test";
import assert from "node:assert/strict";
import { matchDbSeason, planSeasonNumbers } from "./season-numbering.ts";

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

test("matchDbSeason", () => {
  const s = (id: number, season_number: number | null) => ({ id, season_number });
  // by number
  assert.equal(matchDbSeason(2, 3, [s(1, 1), s(2, 2)])?.id, 2);
  // a one-season show takes its only season, whatever its number
  assert.equal(matchDbSeason(1, 1, [s(7, null)])?.id, 7);
  // unnumbered seasons by position, skipping specials
  assert.equal(matchDbSeason(2, 3, [s(1, null), s(2, 0), s(3, null)])?.id, 3);
  // a numbered season at that position is not taken for another number
  assert.equal(matchDbSeason(2, 3, [s(1, null), s(3, 3)]), null);
  // specials only match season 0
  assert.equal(matchDbSeason(0, 2, [s(1, null), s(2, 0)])?.id, 2);
  assert.equal(matchDbSeason(0, 1, [s(1, null)]), null);
});
