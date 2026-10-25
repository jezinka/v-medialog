import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPolish } from "./justwatch.ts";

test("hasPolish", () => {
  assert.equal(hasPolish([]), true); // unknown → keep
  assert.equal(hasPolish(["ja", "en", "de"]), false);
  assert.equal(hasPolish(["ja", "pl"]), true);
  assert.equal(hasPolish(["pl-PL"]), true);
  assert.equal(hasPolish(["plx"]), false);
});
