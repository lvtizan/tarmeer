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

export type LayoutMode = 'dp' | 'blocks';

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

/** Hash a number list into an int to deterministically pick between templates. */
function hash(vals: number[]): number {
  let h = 2166136261;
  for (const v of vals) {
    h ^= Math.round(v * 1000);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/* ------------------------------------------------------------------ */
/*  Procedural template generator                                      */
/*                                                                      */
/*  Instead of hand-curating a few templates per N, generate many       */
/*  variants by combining four orthogonal parameters:                   */
/*                                                                      */
/*    • hero position: left / right / top / bottom                      */
/*    • hero fraction of container: 0.5 / 0.55 / 0.6 / 0.65             */
/*    • grid shape for non-hero cells: all (rows × cols) that can       */
/*      hold exactly (N-1) images                                       */
/*                                                                      */
/*  Each template gets a flat container aspect ratio. Candidates with   */
/*  too-small cells are discarded. The final pick is deterministic via  */
/*  hash(ratios) so the same project always picks the same layout.      */
/* ------------------------------------------------------------------ */

type HeroPosition = 'left' | 'right' | 'top' | 'bottom';

/** Possible (rows, cols) shapes that fit exactly `count` items (up to 4x4). */
function gridShapes(count: number): Array<[number, number]> {
  const shapes: Array<[number, number]> = [];
  for (let rows = 1; rows <= Math.min(4, count); rows++) {
    for (let cols = 1; cols <= Math.min(4, count); cols++) {
      if (rows * cols === count) shapes.push([rows, cols]);
    }
  }
  // If no perfect shape (e.g. count=5, 7), allow one empty slot in last row
  if (shapes.length === 0) {
    for (let rows = 1; rows <= 4; rows++) {
      for (let cols = 1; cols <= 4; cols++) {
        if (rows * cols >= count && rows * cols - count <= 1 && rows * cols <= 12) {
          shapes.push([rows, cols]);
        }
      }
    }
  }
  return shapes;
}

/**
 * Build one candidate template given hero position, hero fraction, and grid shape.
 * Returns null if cells would be too small / degenerate.
 */
function buildTemplate(
  N: number,
  heroPos: HeroPosition,
  heroFrac: number,
  gridRows: number,
  gridCols: number,
  aspect: number,
): BlockTemplate | null {
  const restCount = N - 1;

  // Hero cell + remaining grid area
  let hero: RelCell;
  let gridArea: RelCell;
  switch (heroPos) {
    case 'left':
      hero = { x: 0, y: 0, w: heroFrac, h: 1 };
      gridArea = { x: heroFrac, y: 0, w: 1 - heroFrac, h: 1 };
      break;
    case 'right':
      hero = { x: 1 - heroFrac, y: 0, w: heroFrac, h: 1 };
      gridArea = { x: 0, y: 0, w: 1 - heroFrac, h: 1 };
      break;
    case 'top':
      hero = { x: 0, y: 0, w: 1, h: heroFrac };
      gridArea = { x: 0, y: heroFrac, w: 1, h: 1 - heroFrac };
      break;
    case 'bottom':
      hero = { x: 0, y: 1 - heroFrac, w: 1, h: heroFrac };
      gridArea = { x: 0, y: 0, w: 1, h: 1 - heroFrac };
      break;
  }

  const cellW = gridArea.w / gridCols;
  const cellH = gridArea.h / gridRows;

  // Reject if grid cells would be too thin
  if (cellW < 0.08 || cellH < 0.15) return null;
  if (hero.w < 0.3 || hero.h < 0.3) return null;

  const cells: RelCell[] = [hero];

  // Row-major fill; grow the last row's cells if we'd leave an empty slot
  let placed = 0;
  for (let r = 0; r < gridRows && placed < restCount; r++) {
    const isLastRow = r === gridRows - 1;
    const remaining = restCount - placed;
    const colsThisRow = isLastRow && remaining < gridCols ? remaining : gridCols;
    const rowCellW = gridArea.w / colsThisRow;
    for (let c = 0; c < colsThisRow && placed < restCount; c++) {
      cells.push({
        x: gridArea.x + c * rowCellW,
        y: gridArea.y + r * cellH,
        w: rowCellW,
        h: cellH,
      });
      placed++;
    }
  }

  if (cells.length !== N) return null;
  return { aspect, cells };
}

/** Generate all valid candidate templates for image count N. */
function generateTemplates(N: number): BlockTemplate[] {
  if (N < 2) return [];

  // N=2: canonical side-by-side
  if (N === 2) {
    return [{
      aspect: 2.8,
      cells: [
        { x: 0,   y: 0, w: 0.5, h: 1 },
        { x: 0.5, y: 0, w: 0.5, h: 1 },
      ],
    }];
  }

  // Container aspect (flatter for smaller N; taller slightly for bigger N
  // so grid cells don't get too cramped)
  let aspect: number;
  if (N <= 3)      aspect = 2.7;
  else if (N <= 4) aspect = 2.55;
  else if (N <= 5) aspect = 2.45;
  else if (N <= 6) aspect = 2.35;
  else if (N <= 7) aspect = 2.25;
  else             aspect = 2.15;

  const templates: BlockTemplate[] = [];
  const heroPositions: HeroPosition[] = ['left', 'right', 'top', 'bottom'];
  const heroFracs = [0.5, 0.55, 0.6, 0.65];
  const shapes = gridShapes(N - 1);

  for (const pos of heroPositions) {
    // top/bottom hero: cap hero vertical fraction so it doesn't dominate
    const fracs = (pos === 'top' || pos === 'bottom')
      ? heroFracs.filter(f => f <= 0.55)
      : heroFracs;

    for (const frac of fracs) {
      for (const [rows, cols] of shapes) {
        // Orientation-aware shape filter:
        // vertical hero (left/right) pairs best with tall grids (rows ≥ cols)
        // horizontal hero (top/bottom) pairs best with wide grids (cols ≥ rows)
        if ((pos === 'left' || pos === 'right') && cols > rows + 1) continue;
        if ((pos === 'top' || pos === 'bottom') && rows > cols + 1) continue;

        const t = buildTemplate(N, pos, frac, rows, cols, aspect);
        if (t) templates.push(t);
      }
    }
  }

  return templates;
}

/** Cache templates per N (pure function of N). */
const TEMPLATE_CACHE: Map<number, BlockTemplate[]> = new Map();
function getTemplates(N: number): BlockTemplate[] {
  let t = TEMPLATE_CACHE.get(N);
  if (!t) {
    t = generateTemplates(N);
    TEMPLATE_CACHE.set(N, t);
  }
  return t;
}

/**
 * Deterministic template selection by hash of image ratios.
 * Same project → same template across re-renders and page revisits.
 */
function pickTemplate(ratios: number[], N: number): BlockTemplate | null {
  const templates = getTemplates(N);
  if (templates.length === 0) return null;
  if (templates.length === 1) return templates[0];
  return templates[hash(ratios) % templates.length];
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
/*  Unified dispatcher                                                  */
/* ================================================================== */

export function computeLayout(
  mode: LayoutMode,
  ratios: number[],
  containerWidth: number,
): Layout {
  switch (mode) {
    case 'blocks': return blocksLayout(ratios, containerWidth);
    case 'dp':
    default:       return dpLayout(ratios, containerWidth);
  }
}
