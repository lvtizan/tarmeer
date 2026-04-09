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
/*  Algorithm B: Recursive binary partition (mosaic)                    */
/*                                                                      */
/*  layout(lo, hi, W, H):                                               */
/*    • base: 1 image → single cell (W,H)                               */
/*    • else: try all split points k and both orientations              */
/*        - vertical (left/right): split W by ratio weight              */
/*        - horizontal (top/bottom): try several H-split fractions      */
/*    • cost = Σ (log(displayRatio / naturalRatio))² over all leaves    */
/*    • pick the minimum                                                */
/* ================================================================== */

interface SubLayout {
  cells: LayoutCell[];   // coords relative to sub-rect origin
  cost: number;
}

const H_SPLIT_FRACS = [0.35, 0.45, 0.5, 0.55, 0.65];

function mosaicSplit(
  ratios: number[],
  lo: number,
  hi: number,
  w: number,
  h: number,
): SubLayout {
  const N = hi - lo;

  // Base case: single image fills the sub-rect.
  if (N === 1) {
    const r = ratios[lo] || DEFAULT_RATIO;
    const displayR = h > 0 ? w / h : r;
    const lg = Math.log(displayR / r);
    return {
      cells: [{ idx: lo, x: 0, y: 0, w, h }],
      cost: lg * lg,
    };
  }

  if (w <= 0 || h <= 0) {
    return { cells: [], cost: Infinity };
  }

  let best: SubLayout = { cells: [], cost: Infinity };

  // Also consider: lay out as a single row (all N in this sub-rect as one DP row)
  // This gives an "escape hatch" when recursive slicing would be worse.
  {
    const sumR = sumRatios(ratios, lo, hi);
    const gaps = (N - 1) * GAP;
    const rowH = (w - gaps) / sumR;
    if (rowH > 0) {
      const cells: LayoutCell[] = [];
      let x = 0;
      let cost = 0;
      for (let i = lo; i < hi; i++) {
        const r = ratios[i] || DEFAULT_RATIO;
        const cellW = r * rowH;
        cells.push({ idx: i, x, y: 0, w: cellW, h: rowH });
        // Cost is distortion of each cell (vs natural) + distortion of rowH vs target h
        const displayR = cellW / rowH;
        const lg = Math.log(displayR / r);
        cost += lg * lg;
        x += cellW + GAP;
      }
      // Penalty if rowH doesn't match the sub-rect's available h
      if (h > 0) {
        const rowCentreY = (h - rowH) / 2;
        // Only a valid "row layout" if rowH ≤ h (row fits)
        if (rowH <= h + 1) {
          const vertWaste = Math.max(0, h - rowH);
          const wastePenalty = (vertWaste / h) ** 2 * 4; // prefer full fill
          // Centre the row vertically in the sub-rect
          const centred = cells.map(c => ({ ...c, y: c.y + rowCentreY }));
          if (cost + wastePenalty < best.cost) {
            best = { cells: centred, cost: cost + wastePenalty };
          }
        }
      }
    }
  }
  // Also "single column" (stack vertically)
  {
    const sumInvR = (() => {
      let s = 0;
      for (let i = lo; i < hi; i++) s += 1 / (ratios[i] || DEFAULT_RATIO);
      return s;
    })();
    const gaps = (N - 1) * GAP;
    const colW = w;
    // If each item is at height h_i, width w = ratio_i * h_i, so h_i = w / ratio_i.
    // Total height: sum(w/ratio_i) + gaps = w * sumInvR + gaps
    const totalH = colW * sumInvR + gaps;
    if (totalH <= h + 1 && totalH > 0) {
      const cells: LayoutCell[] = [];
      let y = 0;
      let cost = 0;
      for (let i = lo; i < hi; i++) {
        const r = ratios[i] || DEFAULT_RATIO;
        const cellH = colW / r;
        cells.push({ idx: i, x: 0, y, w: colW, h: cellH });
        // No distortion (by construction)
        y += cellH + GAP;
      }
      const vertWaste = Math.max(0, h - totalH);
      const wastePenalty = (vertWaste / h) ** 2 * 4;
      const centred = cells.map(c => ({ ...c, y: c.y + (h - totalH) / 2 }));
      if (cost + wastePenalty < best.cost) {
        best = { cells: centred, cost: cost + wastePenalty };
      }
    }
  }

  // Recursive splits
  for (let k = lo + 1; k < hi; k++) {
    // ── Vertical split: left | right ──
    {
      const leftSum = sumRatios(ratios, lo, k);
      const rightSum = sumRatios(ratios, k, hi);
      const total = leftSum + rightSum;
      if (total > 0) {
        const avail = w - GAP;
        const leftW = avail * (leftSum / total);
        const rightW = avail - leftW;
        if (leftW > 0 && rightW > 0) {
          const leftR = mosaicSplit(ratios, lo, k, leftW, h);
          const rightR = mosaicSplit(ratios, k, hi, rightW, h);
          const cost = leftR.cost + rightR.cost;
          if (cost < best.cost) {
            const cells = [
              ...leftR.cells,
              ...rightR.cells.map(c => ({ ...c, x: c.x + leftW + GAP })),
            ];
            best = { cells, cost };
          }
        }
      }
    }

    // ── Horizontal split: top | bottom ──
    for (const frac of H_SPLIT_FRACS) {
      const avail = h - GAP;
      const topH = avail * frac;
      const botH = avail - topH;
      if (topH > 20 && botH > 20) {
        const topR = mosaicSplit(ratios, lo, k, w, topH);
        const botR = mosaicSplit(ratios, k, hi, w, botH);
        const cost = topR.cost + botR.cost;
        if (cost < best.cost) {
          const cells = [
            ...topR.cells,
            ...botR.cells.map(c => ({ ...c, y: c.y + topH + GAP })),
          ];
          best = { cells, cost };
        }
      }
    }
  }

  return best;
}

/**
 * Mosaic layout: recursive binary rectangle partition.
 * Container height is chosen based on image count (target ~ TARGET_ROW_HEIGHT × expected rows).
 */
export function mosaicLayout(ratios: number[], containerWidth: number): Layout {
  if (containerWidth <= 0 || ratios.length === 0) return { cells: [], height: 0 };
  const N = ratios.length;

  // Special-case 1 — hero
  if (N === 1) {
    const r = ratios[0] || DEFAULT_RATIO;
    const natural = containerWidth / r;
    const height = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_HERO_HEIGHT, natural));
    return {
      cells: [{ idx: 0, x: 0, y: 0, w: containerWidth, h: height }],
      height,
    };
  }

  // Target container aspect ratio — chosen so ~2 rows worth of images fits
  // Wider for fewer images (single row), taller for many
  let targetAspect: number;
  if (N <= 3)      targetAspect = 2.2;
  else if (N <= 5) targetAspect = 1.9;
  else if (N <= 8) targetAspect = 1.7;
  else             targetAspect = 1.5;

  const containerHeight = containerWidth / targetAspect;

  const result = mosaicSplit(ratios, 0, N, containerWidth, containerHeight);
  if (result.cost === Infinity || result.cells.length === 0) {
    // Mosaic failed to find any layout (shouldn't happen) → DP fallback
    return dpLayout(ratios, containerWidth);
  }

  // Clamp total height and drop any cells sticking below the container
  const actualHeight = result.cells.reduce((max, c) => Math.max(max, c.y + c.h), 0);

  return {
    cells: result.cells,
    height: Math.max(MIN_ROW_HEIGHT, Math.min(actualHeight, MAX_ROW_HEIGHT * 2.2)),
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
