import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSessionDaysMap, groupByYearMonth, monthCells, SEASON_COLORS } from "./calendar-days.ts";

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
