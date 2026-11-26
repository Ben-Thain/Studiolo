/**
 * Corner resize on the 12-column grid. The opposite corner stays put.
 */

import { GRID_COLUMNS } from "./grid";
import type { GridBox } from "./types";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

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
