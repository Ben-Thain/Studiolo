/**
 * Corner resize on the 12-column grid. The opposite corner stays put.
 */

import { GRID_COLUMNS } from "./grid";
import type { GridBox } from "./types";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";
export type ResizeHandleName = ResizeCorner | "n" | "e" | "s" | "w";

export type PxBox = { x: number; y: number; w: number; h: number };

/**
 * Live resize in design pixels. The opposite edge or corner stays fixed.
 * `lockAspect` keeps `aspect` (width / height). Minimum size is in pixels.
 */
export function resizeBoxPx(
  start: PxBox,
  dx: number,
  dy: number,
  handle: ResizeHandleName,
  options?: {
    lockAspect?: boolean;
    aspect?: number;
    minW?: number;
    minH?: number;
    maxRight?: number;
  },
): PxBox {
  const minW = options?.minW ?? 1;
  const minH = options?.minH ?? 1;
  const maxRight = options?.maxRight ?? Number.POSITIVE_INFINITY;
  let x = start.x;
  let y = start.y;
  let w = start.w;
  let h = start.h;
  const movesLeft = handle === "nw" || handle === "w" || handle === "sw";
  const movesRight = handle === "ne" || handle === "e" || handle === "se";
  const movesTop = handle === "nw" || handle === "n" || handle === "ne";
  const movesBottom = handle === "sw" || handle === "s" || handle === "se";
  if (movesLeft) {
    const next = Math.min(start.x + dx, start.x + start.w - minW);
    x = Math.max(0, next);
    w = start.x + start.w - x;
  } else if (movesRight) {
    w = Math.max(minW, start.w + dx);
    if (x + w > maxRight) w = Math.max(minW, maxRight - x);
  }
  if (movesTop) {
    const next = Math.min(start.y + dy, start.y + start.h - minH);
    y = Math.max(0, next);
    h = start.y + start.h - y;
  } else if (movesBottom) {
    h = Math.max(minH, start.h + dy);
  }
  if (options?.lockAspect && options.aspect && options.aspect > 0) {
    const aspect = options.aspect;
    if (movesLeft || movesRight) {
      const nextH = w / aspect;
      if (movesTop) y = y + h - nextH;
      h = Math.max(minH, nextH);
    } else if (movesTop || movesBottom) {
      const nextW = h * aspect;
      if (movesLeft) x = x + w - nextW;
      w = Math.max(minW, nextW);
    }
  }
  return { x, y, w: Math.max(minW, w), h: Math.max(minH, h) };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Resize `start` by a whole-column / whole-row delta, anchored at the
 * corner opposite `corner`. Top-left and bottom-left move `col` with
 * `span`. Top-left and top-right move `row` with `rows`.
 */
export function resizeFromCorner(
  start: GridBox,
  dCol: number,
  dRow: number,
  corner: ResizeCorner,
): GridBox {
  const right = start.col + start.span - 1;
  const bottom = start.row + start.rows - 1;

  if (corner === "se") {
    const col = start.col;
    const span = clampInt(start.span + dCol, 1, GRID_COLUMNS - col + 1);
    return {
      col,
      row: start.row,
      span,
      rows: clampInt(start.rows + dRow, 1, Number.POSITIVE_INFINITY),
    };
  }

  if (corner === "sw") {
    const col = clampInt(start.col + dCol, 1, right);
    return {
      col,
      row: start.row,
      span: right - col + 1,
      rows: clampInt(start.rows + dRow, 1, Number.POSITIVE_INFINITY),
    };
  }

  if (corner === "ne") {
    const row = clampInt(start.row + dRow, 1, bottom);
    return {
      col: start.col,
      row,
      span: clampInt(start.span + dCol, 1, GRID_COLUMNS - start.col + 1),
      rows: bottom - row + 1,
    };
  }

  const col = clampInt(start.col + dCol, 1, right);
  const row = clampInt(start.row + dRow, 1, bottom);
  return {
    col,
    row,
    span: right - col + 1,
    rows: bottom - row + 1,
  };
}
