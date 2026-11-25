/**
 * Design-canvas ↔ grid conversions (1440px artboard, 12 cols, 24px gutter).
 */

import { GRID_COLUMNS, ROW_UNIT_PX } from "@/editor/grid";

export const DESIGN_WIDTH = 1440;
export const GRID_GUTTER = 24;
export const STAGE_PADDING_X = 32;

export function columnWidthPx(
  designWidth = DESIGN_WIDTH,
  gutter = GRID_GUTTER,
  paddingX = STAGE_PADDING_X,
): number {
  const inner = designWidth - paddingX * 2;
  return (inner - (GRID_COLUMNS - 1) * gutter) / GRID_COLUMNS;
}

export function pixelsToGridDelta(
  dx: number,
  dy: number,
  colWidthPx: number,
  rowUnitPx: number = ROW_UNIT_PX,
): { dCol: number; dRow: number } {
  return {
    dCol: Math.round(dx / colWidthPx),
    dRow: Math.round(dy / rowUnitPx),
  };
}

export function gridDeltaFromPixelBox(
  widthPx: number,
  heightPx: number,
  colWidthPx: number,
  rowUnitPx: number = ROW_UNIT_PX,
  gutter = GRID_GUTTER,
): { span: number; rows: number } {
  const span = Math.max(
    1,
    Math.round((widthPx + gutter) / (colWidthPx + gutter)),
  );
  const rows = Math.max(1, Math.round(heightPx / rowUnitPx));
  return { span: Math.min(GRID_COLUMNS, span), rows };
}
