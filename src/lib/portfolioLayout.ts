/* ================================================================== */
/*  Portfolio Layout — three algorithms, one unified cell output        */
/*                                                                      */
/*  Each algorithm returns absolute-positioned cells that fit inside a  */
/*  rectangle of (containerWidth × totalHeight). Renderer uses          */
/*  position:absolute with (x, y, w, h).                                */
/*                                                                      */
/*  Algorithms:                                                         */
/*    • dp      → Knuth-Plass justified rows (current default)          */
/*    • blocks  → hand-curated block templates (hero + grid)            */
/*    • mosaic  → recursive binary rectangle partition                  */
/* ================================================================== */

import {
  justifyRows,
  GAP,
  TARGET_ROW_HEIGHT,
  MAX_ROW_HEIGHT,
  MAX_HERO_HEIGHT,
  MIN_ROW_HEIGHT,
  DEFAULT_RATIO,
} from './justifyRows';

export { GAP, TARGET_ROW_HEIGHT, DEFAULT_RATIO };

export type LayoutMode = 'dp' | 'blocks' | 'mosaic';

export interface LayoutCell {
  idx: number;   // original image index
  x: number;     // px from container left
  y: number;     // px from container top
  w: number;
  h: number;
}

export interface Layout {
  cells: LayoutCell[];
  height: number;       // total container height (px)
}

/* ------------------------------------------------------------------ */
/*  DP → Layout  (convert existing RowLayout[] to unified cells)       */
/* ------------------------------------------------------------------ */

export function dpLayout(ratios: number[], containerWidth: number): Layout {
  if (containerWidth <= 0 || ratios.length === 0) return { cells: [], height: 0 };
  const rows = justifyRows(ratios, containerWidth, TARGET_ROW_HEIGHT);
  const cells: LayoutCell[] = [];
  let y = 0;
  for (const row of rows) {
    let x = 0;
    for (let i = 0; i < row.count; i++) {
      cells.push({
        idx: row.startIdx + i,
        x,
        y,
        w: row.widths[i],
        h: row.height,
      });
      x += row.widths[i] + GAP;
    }
    y += row.height + GAP;
  }
  return { cells, height: Math.max(0, y - GAP) };
}

/* ================================================================== */
/*  Algorithm A: Block templates                                        */
/*                                                                      */
/*  Templates are relative-coordinate cell arrays [0..1]. Container     */
/*  aspect ratio is fixed per template. Images are rendered with        */
/*  object-cover to fit cells regardless of their natural ratio.        */
/* ================================================================== */

interface RelCell { x: number; y: number; w: number; h: number; }
interface BlockTemplate {
  /** container aspect ratio (width / height) */
  aspect: number;
  /** relative cells, covering the full [0,1] rectangle */
  cells: RelCell[];
}

/**
 * Block template library. Keyed by image count.
 * Each template fully tiles [0,1]×[0,1]. Order of cells matches image order.
 */
const BLOCK_TEMPLATES: Record<number, BlockTemplate[]> = {
  2: [
    // side by side
    { aspect: 2.2, cells: [
      { x: 0,   y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ]},
  ],
  3: [
    // hero left + 2 stacked right
    { aspect: 1.9, cells: [
      { x: 0,    y: 0,   w: 0.58, h: 1    },
      { x: 0.58, y: 0,   w: 0.42, h: 0.5  },
      { x: 0.58, y: 0.5, w: 0.42, h: 0.5  },
    ]},
  ],
  4: [
    // hero left + 3 stacked right
    { aspect: 1.75, cells: [
      { x: 0,    y: 0,       w: 0.56, h: 1       },
      { x: 0.56, y: 0,       w: 0.44, h: 1/3     },
      { x: 0.56, y: 1/3,     w: 0.44, h: 1/3     },
      { x: 0.56, y: 2/3,     w: 0.44, h: 1/3     },
    ]},
  ],
  5: [
    // hero left + 2x2 grid right
    { aspect: 1.85, cells: [
      { x: 0,    y: 0,   w: 0.56, h: 1   },
      { x: 0.56, y: 0,   w: 0.22, h: 0.5 },
      { x: 0.78, y: 0,   w: 0.22, h: 0.5 },
      { x: 0.56, y: 0.5, w: 0.22, h: 0.5 },
      { x: 0.78, y: 0.5, w: 0.22, h: 0.5 },
    ]},
  ],
  6: [
    // 2 big top row + 2x2 grid below
    { aspect: 1.6, cells: [
      { x: 0,   y: 0,   w: 0.5,  h: 0.55 },
      { x: 0.5, y: 0,   w: 0.5,  h: 0.55 },
      { x: 0,   y: 0.55, w: 0.25, h: 0.45 },
      { x: 0.25,y: 0.55, w: 0.25, h: 0.45 },
      { x: 0.5, y: 0.55, w: 0.25, h: 0.45 },
      { x: 0.75,y: 0.55, w: 0.25, h: 0.45 },
    ]},
    // hero left + 5 right grid (2 cols, with top-right spanning width 2)
    { aspect: 1.7, cells: [
      { x: 0,    y: 0,       w: 0.56, h: 1     },
      { x: 0.56, y: 0,       w: 0.22, h: 0.5   },
      { x: 0.78, y: 0,       w: 0.22, h: 0.5   },
      { x: 0.56, y: 0.5,     w: 0.22, h: 0.25  },
      { x: 0.78, y: 0.5,     w: 0.22, h: 0.25  },
      { x: 0.56, y: 0.75,    w: 0.44, h: 0.25  },
    ]},
  ],
  7: [
    // hero left + 6 right (2x3 grid)
    { aspect: 1.7, cells: [
      { x: 0,    y: 0,       w: 0.56, h: 1       },
      { x: 0.56, y: 0,       w: 0.22, h: 1/3     },
      { x: 0.78, y: 0,       w: 0.22, h: 1/3     },
      { x: 0.56, y: 1/3,     w: 0.22, h: 1/3     },
      { x: 0.78, y: 1/3,     w: 0.22, h: 1/3     },
      { x: 0.56, y: 2/3,     w: 0.22, h: 1/3     },
      { x: 0.78, y: 2/3,     w: 0.22, h: 1/3     },
    ]},
  ],
  8: [
    // 4 top + 4 bottom
    { aspect: 1.75, cells: [
      { x: 0,    y: 0,   w: 0.25, h: 0.5 },
      { x: 0.25, y: 0,   w: 0.25, h: 0.5 },
      { x: 0.5,  y: 0,   w: 0.25, h: 0.5 },
      { x: 0.75, y: 0,   w: 0.25, h: 0.5 },
      { x: 0,    y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.25, y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.5,  y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.75, y: 0.5, w: 0.25, h: 0.5 },
    ]},
    // hero left + (wide top + 2x3 grid) right = 1 + 1 + 6 = 8
    { aspect: 1.6, cells: [
      { x: 0,    y: 0,   w: 0.56, h: 1    },
      { x: 0.56, y: 0,   w: 0.44, h: 0.4  },
      { x: 0.56, y: 0.4, w: 0.22, h: 0.2  },
      { x: 0.78, y: 0.4, w: 0.22, h: 0.2  },
      { x: 0.56, y: 0.6, w: 0.22, h: 0.2  },
      { x: 0.78, y: 0.6, w: 0.22, h: 0.2  },
      { x: 0.56, y: 0.8, w: 0.22, h: 0.2  },
      { x: 0.78, y: 0.8, w: 0.22, h: 0.2  },
    ]},
  ],
};

/** Hash a number list into an int to deterministically pick between templates. */
function hash(vals: number[]): number {
  let h = 2166136261;
  for (const v of vals) {
    h ^= Math.round(v * 1000);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Sum aspect ratios, guarding against undefined. */
function sumRatios(ratios: number[], lo: number, hi: number): number {
  let s = 0;
  for (let i = lo; i < hi; i++) s += ratios[i] || DEFAULT_RATIO;
  return s;
}

/**
 * Pick the best template for the given ratios (ratio-aware).
 * Currently uses hash for deterministic variety; future: score by distortion.
 */
function pickTemplate(ratios: number[], N: number): BlockTemplate | null {
  const tmpls = BLOCK_TEMPLATES[N];
  if (!tmpls || tmpls.length === 0) return null;
  // Filter out any buggy template with zero-sized cells
  const valid = tmpls.filter(t => t.cells.every(c => c.w > 0 && c.h > 0));
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];
  return valid[hash(ratios) % valid.length];
}

/** Shrink a cell by half a gap on any side that's adjacent to another cell (not container edge). */
function applyGaps(rel: RelCell, containerW: number, containerH: number): { x: number; y: number; w: number; h: number } {
  const eps = 0.001;
  const leftEdge   = rel.x < eps;
  const topEdge    = rel.y < eps;
  const rightEdge  = Math.abs(rel.x + rel.w - 1) < eps;
  const bottomEdge = Math.abs(rel.y + rel.h - 1) < eps;

  const x = rel.x * containerW + (leftEdge ? 0 : GAP / 2);
  const y = rel.y * containerH + (topEdge ? 0 : GAP / 2);
  const w = rel.w * containerW - (leftEdge ? 0 : GAP / 2) - (rightEdge ? 0 : GAP / 2);
  const h = rel.h * containerH - (topEdge ? 0 : GAP / 2) - (bottomEdge ? 0 : GAP / 2);
  return { x, y, w, h };
}

export function blocksLayout(ratios: number[], containerWidth: number): Layout {
  if (containerWidth <= 0 || ratios.length === 0) return { cells: [], height: 0 };
  const N = ratios.length;

  // N=1 — full-width hero with natural aspect (clamped)
  if (N === 1) {
    const r = ratios[0] || DEFAULT_RATIO;
    const natural = containerWidth / r;
    const height = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_HERO_HEIGHT, natural));
    return {
      cells: [{ idx: 0, x: 0, y: 0, w: containerWidth, h: height }],
      height,
    };
  }

  const tmpl = pickTemplate(ratios, N);
  if (!tmpl) {
    // No template for this N → fall back to DP
    return dpLayout(ratios, containerWidth);
  }

  const containerH = containerWidth / tmpl.aspect;
  const cells: LayoutCell[] = tmpl.cells.map((rel, i) => {
    const rect = applyGaps(rel, containerWidth, containerH);
    return { idx: i, ...rect };
  });
  return { cells, height: containerH };
}

/* ================================================================== */
/*  Algorithm B: Hero column + justified-row grid (O(N) per candidate)  */
/*                                                                      */
/*  For each candidate hero size k (1 or 2 images stacked on the left), */
/*  compute the optimal container height H so that:                     */
/*    • hero column width × k images (stacked) = container height H    */
/*    • remaining (N-k) images form justified rows in (W - heroW, H)   */
/*    • sum of justified-row heights ≈ H                               */
/*                                                                      */
/*  We search H in a range and pick the (k, H) minimizing total         */
/*  distortion + height-mismatch penalty. This is O(N × H_STEPS).       */
/* ================================================================== */

/** Sum of inverse ratios — used to compute column height from width. */
function sumInverseRatios(ratios: number[], lo: number, hi: number): number {
  let s = 0;
  for (let i = lo; i < hi; i++) s += 1 / (ratios[i] || DEFAULT_RATIO);
  return s;
}

/** Build a single justified row of images into cells at given (x, y), returns cells + row height. */
function buildJustifiedRow(
  ratios: number[],
  lo: number,
  hi: number,
  rowW: number,
  xOffset: number,
  yOffset: number,
): { cells: LayoutCell[]; height: number } {
  const count = hi - lo;
  const sumR = sumRatios(ratios, lo, hi);
  const gaps = (count - 1) * GAP;
  const rowH = (rowW - gaps) / sumR;
  if (rowH <= 0) return { cells: [], height: 0 };

  const cells: LayoutCell[] = [];
  let x = xOffset;
  for (let i = lo; i < hi; i++) {
    const r = ratios[i] || DEFAULT_RATIO;
    const w = r * rowH;
    cells.push({ idx: i, x, y: yOffset, w, h: rowH });
    x += w + GAP;
  }
  return { cells, height: rowH };
}

/** Partition remaining images into justified rows that fit inside (W, H). */
function buildGridInBox(
  ratios: number[],
  lo: number,
  hi: number,
  W: number,
  H: number,
): { cells: LayoutCell[]; usedHeight: number; cost: number } {
  const N = hi - lo;
  if (N === 0) return { cells: [], usedHeight: 0, cost: 0 };

  // Use the DP justifier on the subrange, scaled as if it had its own width.
  // We build our own simpler version here: pick row counts to make total
  // height fit H as closely as possible.
  // Strategy: greedy rows of ~sqrt(N) items each, adjust to minimize |total - H|.

  // Candidate numbers of rows: 1..N (but cap at 4 for grids)
  const maxRows = Math.min(4, N);
  let best: { cells: LayoutCell[]; usedHeight: number; cost: number } | null = null;

  for (let numRows = 1; numRows <= maxRows; numRows++) {
    // Try to distribute N items evenly across numRows
    const perRow = Math.ceil(N / numRows);
    const rowSplits: Array<[number, number]> = [];
    for (let r = 0; r < numRows; r++) {
      const start = lo + r * perRow;
      const end = Math.min(hi, start + perRow);
      if (start >= end) break;
      rowSplits.push([start, end]);
    }
    if (rowSplits.length === 0) continue;

    // Build rows and compute total height
    const cells: LayoutCell[] = [];
    let y = 0;
    for (const [s, e] of rowSplits) {
      const row = buildJustifiedRow(ratios, s, e, W, 0, y);
      if (row.height <= 0) { y = -1; break; }
      cells.push(...row.cells);
      y += row.height + GAP;
    }
    if (y < 0) continue;
    const usedHeight = y - GAP;

    // Cost: how far is usedHeight from target H? (squared)
    const mismatch = Math.abs(usedHeight - H);
    const cost = mismatch * mismatch;

    if (!best || cost < best.cost) {
      best = { cells, usedHeight, cost };
    }
  }

  return best || { cells: [], usedHeight: 0, cost: Infinity };
}

export function mosaicLayout(ratios: number[], containerWidth: number): Layout {
  if (containerWidth <= 0 || ratios.length === 0) return { cells: [], height: 0 };
  const N = ratios.length;

  // N=1 — full-width hero
  if (N === 1) {
    const r = ratios[0] || DEFAULT_RATIO;
    const natural = containerWidth / r;
    const height = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_HERO_HEIGHT, natural));
    return {
      cells: [{ idx: 0, x: 0, y: 0, w: containerWidth, h: height }],
      height,
    };
  }

  // N=2,3 → use blocks templates for consistency
  if (N <= 3) {
    return blocksLayout(ratios, containerWidth);
  }

  // N ≥ 4: hero-column + right-grid
  // Try hero sizes 1 and 2 (single big image OR two stacked)
  let best: { cells: LayoutCell[]; height: number; cost: number } | null = null;

  for (let heroCount = 1; heroCount <= 2; heroCount++) {
    if (heroCount >= N) break;

    // Search for optimal hero width (fraction of container)
    for (let heroFrac = 0.45; heroFrac <= 0.7; heroFrac += 0.05) {
      const heroW = (containerWidth - GAP) * heroFrac;
      const gridW = containerWidth - GAP - heroW;
      if (heroW <= 0 || gridW <= 0) continue;

      // Hero column height: determined by stacking hero images at this width
      // Each hero image has height = heroW / ratio[i], plus gaps between.
      const heroSumInv = sumInverseRatios(ratios, 0, heroCount);
      const heroGaps = (heroCount - 1) * GAP;
      const heroHeight = heroW * heroSumInv + heroGaps;

      if (heroHeight < MIN_ROW_HEIGHT || heroHeight > MAX_ROW_HEIGHT * 2.2) continue;

      // Fit remaining images into (gridW × heroHeight)
      const grid = buildGridInBox(ratios, heroCount, N, gridW, heroHeight);
      if (grid.cost === Infinity || grid.cells.length === 0) continue;

      // Build hero cells
      const heroCells: LayoutCell[] = [];
      let hy = 0;
      for (let i = 0; i < heroCount; i++) {
        const r = ratios[i] || DEFAULT_RATIO;
        const cellH = heroW / r;
        heroCells.push({ idx: i, x: 0, y: hy, w: heroW, h: cellH });
        hy += cellH + GAP;
      }

      // Offset grid cells by (heroW + GAP, 0)
      const gridCellsShifted = grid.cells.map(c => ({
        ...c,
        x: c.x + heroW + GAP,
      }));

      // Cost: grid height mismatch + aesthetic count/frac penalty
      // Prefer heroCount=1 (more impactful) and heroFrac around 0.55
      const heroBias = heroCount === 1 ? 0 : 500;
      const fracBias = (heroFrac - 0.55) ** 2 * 2000;
      const totalCost = grid.cost + heroBias + fracBias;

      const allCells = [...heroCells, ...gridCellsShifted];
      const totalHeight = Math.max(heroHeight, grid.usedHeight);

      if (!best || totalCost < best.cost) {
        best = { cells: allCells, height: totalHeight, cost: totalCost };
      }
    }
  }

  if (!best || best.cells.length !== N) {
    // Couldn't build a valid hero+grid → fall back to DP
    return dpLayout(ratios, containerWidth);
  }

  return {
    cells: best.cells,
    height: Math.max(MIN_ROW_HEIGHT, Math.min(best.height, MAX_ROW_HEIGHT * 2.5)),
  };
}

/* ================================================================== */
/*  Unified dispatcher                                                  */
/* ================================================================== */

export function computeLayout(
  mode: LayoutMode,
  ratios: number[],
  containerWidth: number,
): Layout {
  switch (mode) {
    case 'blocks': return blocksLayout(ratios, containerWidth);
    case 'mosaic': return mosaicLayout(ratios, containerWidth);
    case 'dp':
    default:        return dpLayout(ratios, containerWidth);
  }
}
