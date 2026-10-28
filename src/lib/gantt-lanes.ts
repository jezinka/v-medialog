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
