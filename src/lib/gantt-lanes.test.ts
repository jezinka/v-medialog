import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeRuns, packLanes } from "./gantt-lanes.ts";

test("overlapping spans get separate rows, later ones reuse freed rows", () => {
  const r = packLanes([
    { key: 1, start: 0, end: 5 },
    { key: 2, start: 3, end: 8 },
    { key: 3, start: 6, end: 7 },
  ]);
  assert.deepEqual(r, { lanes: [0, 1, 0], count: 2 });
});

test("spans touching on the same day overlap", () => {
  assert.deepEqual(packLanes([{ key: 1, start: 0, end: 2 }, { key: 2, start: 2, end: 3 }]).lanes, [0, 1]);
});

test("a title's next session goes back to its row when free", () => {
  const r = packLanes([
    { key: 1, start: 0, end: 1 },
    { key: 2, start: 0, end: 9 },
    { key: 3, start: 3, end: 4 },
    { key: 2, start: 12, end: 13 },
  ]);
  // Without the preference key 2 would take row 0, the first free one
  assert.deepEqual(r.lanes, [0, 1, 0, 1]);
});

test("input order doesn't matter", () => {
  const r = packLanes([{ key: 2, start: 5, end: 6 }, { key: 1, start: 0, end: 9 }]);
  assert.deepEqual(r, { lanes: [1, 0], count: 2 });
});

test("sessions of a title with short gaps merge into one run", () => {
  const runs = mergeRuns([
    { key: 1, start: 10, end: 12 },
    { key: 1, start: 0, end: 2 },
    { key: 2, start: 1, end: 1 },
    { key: 1, start: 5, end: 6 },
  ], 7);
  assert.deepEqual(runs.map(({ key, start, end, members }) => [key, start, end, members.length]), [[1, 0, 12, 3], [2, 1, 1, 1]]);
});

test("a gap longer than the limit starts a new run", () => {
  const runs = mergeRuns([{ key: 1, start: 0, end: 0 }, { key: 1, start: 8, end: 8 }, { key: 1, start: 17, end: 17 }], 7);
  // 7 free days between 0 and 8 merge; 8 free days between 8 and 17 don't
  assert.deepEqual(runs.map((r) => [r.start, r.end]), [[0, 8], [17, 17]]);
});

test("a session inside a longer one doesn't shorten the run", () => {
  assert.deepEqual(mergeRuns([{ key: 1, start: 0, end: 20 }, { key: 1, start: 3, end: 4 }], 7).map((r) => [r.start, r.end]), [[0, 20]]);
});
