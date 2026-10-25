import { test } from "node:test";
import assert from "node:assert/strict";
import { TYPE_FILTERS } from "./types.ts";
import { MEDIA_TYPES } from "../../lib/utils.ts";

test("library has a type filter chip for every media type", () => {
  assert.deepEqual([...MEDIA_TYPES].filter((t) => !(TYPE_FILTERS as readonly string[]).includes(t)), []);
});
