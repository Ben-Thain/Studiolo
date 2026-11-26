import { ROW_UNIT_PX } from "./grid";

/**
 * Grow a text box so its rows cover the measured height.
 * Never shrinks below the rows the user already set.
 */
export function autofitRows(
  currentRows: number,
  measuredHeightPx: number,
): number {
  const needed = Math.max(1, Math.ceil(measuredHeightPx / ROW_UNIT_PX));
  return Math.max(currentRows, needed);
}
