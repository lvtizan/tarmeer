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
/*  Algorithm B: Hero-TOP (wide top image + justified rows below)      */
/*                                                                      */
/*  Visually distinct from A (which is hero-LEFT):                      */
/*    • The first image is a wide top hero banner (full container      */
/*      width, natural aspect ratio clamped).                           */
/*    • Remaining images flow below as justified rows (using the        */
/*      existing DP justifier).                                         */
/*    • Hero height adapts to the first image's natural ratio.          */
/*    • For N=2 or 3 we use a top-hero + single-row-below pattern so    */
/*      even small groups get the characteristic top-banner feel.       */
/* ================================================================== */

/** Hero height choice: clamp natural height to a band that keeps layout balanced. */
function chooseHeroHeight(ratio: number, width: number): number {
  const natural = width / ratio;
  // Target band: 280..460 px (slightly shorter than a pure hero so below
  // content feels connected). Clamp to that range.
  return Math.max(260, Math.min(460, natural));
}

export function mosaicLayout(ratios: number[], containerWidth: number): Layout {
  if (containerWidth <= 0 || ratios.length === 0) return { cells: [], height: 0 };
  const N = ratios.length;

  // N=1 — full-width hero (same as other modes)
  if (N === 1) {
    const r = ratios[0] || DEFAULT_RATIO;
    const natural = containerWidth / r;
    const height = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_HERO_HEIGHT, natural));
    return {
      cells: [{ idx: 0, x: 0, y: 0, w: containerWidth, h: height }],
      height,
    };
  }

  // N=2 — top hero + single image below (full width)
  if (N === 2) {
    const heroH = chooseHeroHeight(ratios[0] || DEFAULT_RATIO, containerWidth);
    const secondR = ratios[1] || DEFAULT_RATIO;
    const secondH = Math.max(180, Math.min(340, containerWidth / secondR));
    return {
      cells: [
        { idx: 0, x: 0, y: 0, w: containerWidth, h: heroH },
        { idx: 1, x: 0, y: heroH + GAP, w: containerWidth, h: secondH },
      ],
      height: heroH + GAP + secondH,
    };
  }

  // N=3 — top hero + 2 images in a single row below
  if (N === 3) {
    const heroH = chooseHeroHeight(ratios[0] || DEFAULT_RATIO, containerWidth);
    const r1 = ratios[1] || DEFAULT_RATIO;
    const r2 = ratios[2] || DEFAULT_RATIO;
    const rowH = (containerWidth - GAP) / (r1 + r2);
    const w1 = r1 * rowH;
    const w2 = containerWidth - GAP - w1;
    return {
      cells: [
        { idx: 0, x: 0, y: 0, w: containerWidth, h: heroH },
        { idx: 1, x: 0, y: heroH + GAP, w: w1, h: rowH },
        { idx: 2, x: w1 + GAP, y: heroH + GAP, w: w2, h: rowH },
      ],
      height: heroH + GAP + rowH,
    };
  }

  // N ≥ 4 — top hero + justified-row grid below
  const heroH = chooseHeroHeight(ratios[0] || DEFAULT_RATIO, containerWidth);
  const belowRatios = ratios.slice(1);

  // Reuse the DP justifier for the "below" area. Use a slightly shorter
  // target row height than the page default so rows below feel proportionate.
  const belowRows = justifyRows(belowRatios, containerWidth, 240);
  if (belowRows.length === 0) {
    // Empty grid below — shouldn't happen with N≥4, but guard
    return {
      cells: [{ idx: 0, x: 0, y: 0, w: containerWidth, h: heroH }],
      height: heroH,
    };
  }

  const cells: LayoutCell[] = [
    { idx: 0, x: 0, y: 0, w: containerWidth, h: heroH },
  ];

  let y = heroH + GAP;
  for (const row of belowRows) {
    let x = 0;
    for (let i = 0; i < row.count; i++) {
      cells.push({
        idx: row.startIdx + i + 1, // +1 accounts for hero at idx 0
        x,
        y,
        w: row.widths[i],
        h: row.height,
      });
      x += row.widths[i] + GAP;
    }
    y += row.height + GAP;
  }

  return { cells, height: y - GAP };
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
