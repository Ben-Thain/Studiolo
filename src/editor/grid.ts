/**
 * The editor grid: 12 columns, 8px row units (prompt 05).
 */

import type { GridBox } from "./types";

export const GRID_COLUMNS = 12;
export const ROW_UNIT_PX = 8;
export const MOBILE_STACK_GAP_ROWS = 3;

export const DEFAULT_TEXT_ROWS = 6;
export const DEFAULT_IMAGE_ROWS = 40;
export const DEFAULT_NAV_ROWS = 4;

export function snapCol(value: number): number {
  return Math.min(GRID_COLUMNS, Math.max(1, Math.round(value)));
}

export function snapSpan(value: number, col: number): number {
  const span = Math.max(1, Math.round(value));
  return Math.min(span, GRID_COLUMNS - col + 1);
}

export function snapRow(value: number): number {
  return Math.max(1, Math.round(value));
}

export function snapRowSpan(value: number): number {
  return Math.max(1, Math.round(value));
}

/** Fit a box into the grid, snapping every field. */
export function snapBox(box: GridBox): GridBox {
  const col = snapCol(box.col);
  return {
    col,
    span: snapSpan(box.span, col),
    row: snapRow(box.row),
    rows: snapRowSpan(box.rows),
  };
}

/** The first row after the bottom of `boxes`, plus optional gap rows. */
export function rowBelow(boxes: GridBox[], gapRows = 0): number {
  if (boxes.length === 0) return 1;
  const end = Math.max(...boxes.map((b) => b.row + b.rows));
  return end + gapRows;
}

/** Default desktop column span for a new element type. */
export function defaultDesktopSpan(type: "text" | "image" | "nav" | "form"): {
  col: number;
  span: number;
} {
  if (type === "image") return { col: 7, span: 6 };
  return { col: 1, span: 6 };
}

export function defaultDesktopRows(type: "text" | "image" | "nav" | "form"): number {
  switch (type) {
    case "image":
      return DEFAULT_IMAGE_ROWS;
    case "nav":
      return DEFAULT_NAV_ROWS;
    case "form":
      return DEFAULT_IMAGE_ROWS;
    default:
      return DEFAULT_TEXT_ROWS;
  }
}

export function boxesOverlap(a: GridBox, b: GridBox): boolean {
  const aColEnd = a.col + a.span;
  const bColEnd = b.col + b.span;
  const aRowEnd = a.row + a.rows;
  const bRowEnd = b.row + b.rows;
  return (
    a.col < bColEnd &&
    aColEnd > b.col &&
    a.row < bRowEnd &&
    aRowEnd > b.row
  );
}