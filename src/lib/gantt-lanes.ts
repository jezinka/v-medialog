export interface GanttSpan { key: number; start: number; end: number }

/**
 * Packs spans (inclusive day indices) into as few rows as possible, in start order.
 * A span goes back to its key's previous row when that row is free, so a title's sessions line up.
 * Returns the row of each span, in input order, and the row count.
 */
export function packLanes(spans: GanttSpan[]): { lanes: number[]; count: number } {
  const order = spans.map((_, i) => i).sort((a, b) => spans[a].start - spans[b].start || spans[a].end - spans[b].end);
  const rowEnds: number[] = [];
  const lastRow = new Map<number, number>();
  const lanes = new Array<number>(spans.length);
  for (const i of order) {
    const { key, start, end } = spans[i];
    let row = lastRow.get(key);
    if (row === undefined || rowEnds[row] >= start) {
      row = rowEnds.findIndex((e) => e < start);
      if (row < 0) row = rowEnds.push(-1) - 1;
    }
    rowEnds[row] = end;
    lastRow.set(key, row);
    lanes[i] = row;
  }
  return { lanes, count: rowEnds.length };
}

/**
 * Merges spans of the same key whose gap is at most `maxGap` days into one run,
 * so a series watched over a few weeks reads as one bar. Runs come back in start order.
 */
export function mergeRuns<T extends GanttSpan>(spans: T[], maxGap: number): { key: number; start: number; end: number; members: T[] }[] {
  const runs: { key: number; start: number; end: number; members: T[] }[] = [];
  const open = new Map<number, (typeof runs)[number]>();
  for (const s of [...spans].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const run = open.get(s.key);
    if (run && s.start - run.end - 1 <= maxGap) {
      run.end = Math.max(run.end, s.end);
      run.members.push(s);
    } else {
      const next = { key: s.key, start: s.start, end: s.end, members: [s] };
      runs.push(next);
      open.set(s.key, next);
    }
  }
  return runs;
}
