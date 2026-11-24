/**
 * CSS grid-column / grid-row output for placed elements (prompt 05).
 * Server-safe: no window, no DOM.
 */

import type { GridBox } from "./types";

export type GridPlacementStyle = {
  gridColumn: string;
  gridRow: string;
};

export function gridPlacement(box: GridBox): GridPlacementStyle {
  return {
    gridColumn: `${box.col} / span ${box.span}`,
    gridRow: `${box.row} / span ${box.rows}`,
  };
}

/** grid-auto-rows value for an 8px row unit. */
export const GRID_AUTO_ROWS = "minmax(8px, auto)";
