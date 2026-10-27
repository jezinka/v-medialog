import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSessionDaysMap, getDaysInMonth, getFirstDayOfMonth, getPolishHolidays, groupByYearMonth, monthCells, SEASON_COLORS } from "./calendar-days.ts";

test("monthCells pads to Monday", () => {
  // 1 Oct 2026 is a Thursday → 3 empty cells
  const cells = monthCells(2026, 10);
  assert.deepEqual(cells.slice(0, 4), [null, null, null, 1]);
  assert.equal(cells.at(-1), 31);
  assert.equal(monthCells(2024, 2).filter(Boolean).length, 29);
});

test("buildSessionDaysMap colors days per season and skips year-long placeholders", () => {
  const seasons = [{ id: 1 }, { id: 2 }];
  const days = buildSessionDaysMap([
    { season_id: 1, start_date: "2026-01-30", end_date: "2026-02-01" },
    { season_id: 2, start_date: "2026-03-05", end_date: null },
    { season_id: 2, start_date: "2025-01-01", end_date: "2025-12-31" },
  ], seasons);
  assert.deepEqual([...days.keys()], ["2026-01-30", "2026-01-31", "2026-02-01", "2026-03-05"]);
  assert.equal(days.get("2026-01-31"), SEASON_COLORS[0]);
  assert.equal(days.get("2026-03-05"), SEASON_COLORS[1]);

  const grouped = groupByYearMonth(days);
  assert.deepEqual([...grouped.keys()], ["2026-01", "2026-02", "2026-03"]);
  assert.equal(grouped.get("2026-01")!.size, 2);
});

test("month helpers: Monday-first offset and month length", () => {
  assert.equal(getFirstDayOfMonth(2026, 10), 3); // Thursday
  assert.equal(getFirstDayOfMonth(2026, 2), 6); // Sunday
  assert.equal(getDaysInMonth(2024, 2), 29);
  assert.equal(getDaysInMonth(2026, 12), 31);
});

test("getPolishHolidays includes Easter-based and fixed holidays", () => {
  const h = getPolishHolidays(2026);
  // Easter 2026: 5 April → Easter Monday 6 April, Pentecost 24 May, Corpus Christi 4 June
  for (const d of ["2026-04-05", "2026-04-06", "2026-05-24", "2026-06-04", "2026-11-11", "2026-12-24"]) assert.ok(h.has(d), d);
  assert.equal(h.size, 14);
  assert.ok(!h.has("2026-04-07"));
});
