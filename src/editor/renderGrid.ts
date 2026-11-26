/**
 * CSS grid-column / grid-row output for placed elements (prompt 05).
 * Server-safe: no window, no DOM.
 */

import type { GridBox } from "./types";

export type GridPlacementStyle = {
  gridColumn: string;
  gridRow: string;
  zIndex: number;
};

export const GRID_TEMPLATE = "repeat(96, minmax(0, 1fr))";

export function gridPlacement(box: GridBox): GridPlacementStyle {
  return {
    gridColumn: `${box.col} / span ${box.span}`,
    gridRow: `${box.row} / span ${box.rows}`,
    zIndex: (box.z ?? 0) + 1,
  };
}

/** grid-auto-rows value for an 8px row unit. */
export const GRID_AUTO_ROWS = "minmax(8px, auto)";
