import { test } from "node:test";
import assert from "node:assert/strict";
import { pageList } from "./page-list.ts";

test("pageList shows every page when there are few", () => {
  assert.deepEqual(pageList(1, 4), [1, 2, 3, 4]);
});

test("pageList keeps the ends and two pages around the current one, with gaps marked", () => {
  assert.deepEqual(pageList(10, 20), [1, "...", 8, 9, 10, 11, 12, "...", 20]);
  assert.deepEqual(pageList(2, 20), [1, 2, 3, 4, "...", 20]);
});
