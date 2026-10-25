import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByDate, monthRange, seasonsLabel, shiftMonth, upcomingCheckDue } from "./schedule.ts";

test("monthRange covers the whole month and rejects junk", () => {
  assert.deepEqual(monthRange("2026-02"), { first: "2026-02-01", last: "2026-02-28" });
  assert.deepEqual(monthRange("2028-02"), { first: "2028-02-01", last: "2028-02-29" });
  assert.equal(monthRange("2026-13"), null);
  assert.equal(monthRange("2026-1; DROP"), null);
});

test("shiftMonth crosses years", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});

test("upcoming check is due in a new month or after a week", () => {
  const now = new Date(2026, 10, 3, 12);
  assert.equal(upcomingCheckDue(null, now), true);
  assert.equal(upcomingCheckDue(new Date(2026, 9, 31, 12).toISOString(), now), true);
  assert.equal(upcomingCheckDue(new Date(2026, 10, 1, 12).toISOString(), now), false);
  assert.equal(upcomingCheckDue(new Date(2026, 10, 1, 12).toISOString(), new Date(2026, 10, 9, 12)), true);
});

test("groupByDate sorts and groups", () => {
  const g = groupByDate([{ air_date: "2026-11-20", t: "B" }, { air_date: "2026-11-05", t: "A" }, { air_date: "2026-11-20", t: "C" }]);
  assert.deepEqual(g.map((d) => [d.date, d.items.map((i) => i.t)]), [["2026-11-05", ["A"]], ["2026-11-20", ["B", "C"]]]);
});

test("seasonsLabel uses Polish plurals", () => {
  assert.deepEqual([1, 2, 5, 12, 13, 22, 25, 101].map(seasonsLabel),
    ["1 sezon", "2 sezony", "5 sezonów", "12 sezonów", "13 sezonów", "22 sezony", "25 sezonów", "101 sezonów"]);
});
