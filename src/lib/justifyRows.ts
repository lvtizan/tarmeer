/* ================================================================== */
/*  Justified-row layout engine (DP, Knuth-Plass style)                */
/*                                                                      */
/*  Global optimum via DP. Each row fills full container width.         */
/*  Small-N (1..3) has hard-coded optimal layouts.                      */
/*  For N ≥ 4, DP minimizes a composite cost:                           */
/*    • (rowHeight - target)²    → height consistency                   */
/*    • (count - ideal)² × 400   → prefer 4 per row                     */
/*    • orphanPenalty            → forbid 1-2 image trailing rows       */
/* ================================================================== */

export const GAP = 6;
export const TARGET_ROW_HEIGHT = 280;        // ideal row height
export const MAX_ROW_HEIGHT = 420;           // hard ceiling for regular rows
export const MAX_HERO_HEIGHT = 520;          // ceiling for small-N hero/duet rows
export const MIN_ROW_HEIGHT = 180;           // crush threshold
export const DEFAULT_RATIO = 1.33;           // 4:3
export const IDEAL_ROW_COUNT = 4;            // DP prefers this many images per row
export const COUNT_PENALTY_WEIGHT = 400;     // weight for count deviation
export const ORPHAN_PENALTY = 80000;         // heavy — last row < 3 images with prior rows

export interface RowLayout {
  startIdx: number;
  count: number;
  height: number;
  widths: number[];  // per-image width in this row
}

/** Compute un-clamped row height that would make row[start..end) exactly fill container. */
function naturalRowHeight(
  ratios: number[],
  start: number,
  end: number,
  containerWidth: number,
): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += ratios[i] || DEFAULT_RATIO;
  const gaps = (end - start - 1) * GAP;
  if (sum <= 0) return 0;
  return (containerWidth - gaps) / sum;
}

/** Build a fully-justified row (widths sum + gaps = containerWidth). */
function buildRow(
  ratios: number[],
  start: number,
  end: number,
  containerWidth: number,
  maxH: number,
): RowLayout {
  const count = end - start;
  const natural = naturalRowHeight(ratios, start, end, containerWidth);
  const height = Math.max(MIN_ROW_HEIGHT, Math.min(maxH, natural));

  const widths: number[] = [];
  let used = 0;
  for (let i = start; i < end; i++) {
    const w = (ratios[i] || DEFAULT_RATIO) * height;
    widths.push(w);
    used += w;
  }

  // Distribute rounding / clamping residual across all items so the row fills.
  // (If height was clamped down from natural, we still stretch widths to fill.)
  const gaps = (count - 1) * GAP;
  const remainder = containerWidth - used - gaps;
  if (count > 0 && Math.abs(remainder) > 0.5) {
    const adj = remainder / count;
    for (let i = 0; i < count; i++) widths[i] += adj;
  }

  return { startIdx: start, count, height, widths };
}

/**
 * Partition images into justified rows (DP optimal for N ≥ 4, hard-coded for N ≤ 3).
 */
export function justifyRows(
  ratios: number[],
  containerWidth: number,
  targetH: number,
): RowLayout[] {
  if (containerWidth <= 0 || ratios.length === 0) return [];
  const N = ratios.length;

  // ── Small-N hard cases: always a single row, never empty gutter ──
  if (N === 1) {
    const r = ratios[0] || DEFAULT_RATIO;
    // Full-width hero; clamp to hero ceiling for portraits/panoramas
    const natural = containerWidth / r;
    const height = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_HERO_HEIGHT, natural));
    const width = height * r;
    // Center-ish: just set width to container if clamping didn't shrink
    const finalWidth = natural <= MAX_HERO_HEIGHT ? containerWidth : width;
    return [{ startIdx: 0, count: 1, height, widths: [finalWidth] }];
  }
  if (N <= 3) {
    return [buildRow(ratios, 0, N, containerWidth, MAX_HERO_HEIGHT)];
  }

  // ── DP for N ≥ 4 ──
  // cost[i] = min total cost to lay out ratios[0..i)
  // parent[i] = start index of the last row (i.e. row = [parent[i], i))
  const cost = new Array<number>(N + 1).fill(Infinity);
  const parent = new Array<number>(N + 1).fill(0);
  cost[0] = 0;

  // Cap row count between 2 and 7 for reasonable layouts
  const MAX_ROW_COUNT = 7;
  const MIN_ROW_COUNT = 2;

  for (let i = 1; i <= N; i++) {
    for (let count = MIN_ROW_COUNT; count <= MAX_ROW_COUNT; count++) {
      const j = i - count;
      if (j < 0) break;
      if (cost[j] === Infinity) continue;

      const natural = naturalRowHeight(ratios, j, i, containerWidth);
      if (natural <= 0) continue;

      // Clamp for cost computation (actual build may re-clamp)
      const clampedH = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, natural));

      // Height deviation from target (squared)
      const heightCost = (clampedH - targetH) ** 2;

      // Crush/overflow penalty: if natural was far outside the clamp range,
      // penalize heavily (row will look wrong after clamping)
      let clampCost = 0;
      if (natural < MIN_ROW_HEIGHT) {
        clampCost = (MIN_ROW_HEIGHT - natural) ** 2 * 20;
      } else if (natural > MAX_ROW_HEIGHT * 1.3) {
        clampCost = (natural - MAX_ROW_HEIGHT * 1.3) ** 2 * 5;
      }

      // Preference for ~4 images per row
      const countCost = (count - IDEAL_ROW_COUNT) ** 2 * COUNT_PENALTY_WEIGHT;

      // Orphan penalty: last row with < 3 images when we have prior rows
      let orphanCost = 0;
      if (i === N && count < 3 && j > 0) {
        orphanCost = ORPHAN_PENALTY;
      }

      const total = cost[j] + heightCost + clampCost + countCost + orphanCost;
      if (total < cost[i]) {
        cost[i] = total;
        parent[i] = j;
      }
    }

    // Fallback: if no valid split reached i (e.g., single huge image), allow count=1
    if (cost[i] === Infinity) {
      const j = i - 1;
      if (cost[j] !== Infinity) {
        cost[i] = cost[j] + 1e9; // not ideal but valid
        parent[i] = j;
      }
    }
  }

  // Backtrack
  const rows: RowLayout[] = [];
  let i = N;
  while (i > 0) {
    const j = parent[i];
    // Last row (first we push) gets a slightly higher ceiling so a balanced
    // trailing row with 3 images can breathe
    const isLastRow = rows.length === 0;
    const maxH = isLastRow ? MAX_ROW_HEIGHT * 1.15 : MAX_ROW_HEIGHT;
    rows.unshift(buildRow(ratios, j, i, containerWidth, maxH));
    i = j;
  }

  return rows;
}
