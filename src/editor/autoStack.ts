/**
 * Mobile auto-stack for one section's elements (prompt 05). Reading order is
 * desktop row, then column, then sort order. Each item is full width with a
 * 3-row gap between elements. Manual mobile layouts are preserved; row heights
 * come from existing mobile rows, not desktop.
 */

import { MOBILE_STACK_GAP_ROWS, snapBox, rowBelow } from "./grid";
import type { GridBox, PlacementSource } from "./types";

export type StackItem = {
  id: string;
  sortOrder: number;
  desktop: GridBox;
  mobile: GridBox;
  placementSource: PlacementSource;
};

export function autoStack(items: StackItem[]): Map<string, GridBox> {
  const out = new Map<string, GridBox>();

  for (const item of items) {
    if (item.placementSource === "manual") {
      out.set(item.id, snapBox({ ...item.mobile }));
    }
  }

  const ordered = [...items]
    .filter((item) => item.placementSource !== "manual")
    .sort(
      (a, b) =>
        a.desktop.row - b.desktop.row ||
        a.desktop.col - b.desktop.col ||
        a.sortOrder - b.sortOrder,
    );

  const manualRows = [...out.values()];
  let row =
    manualRows.length > 0 ? rowBelow(manualRows, MOBILE_STACK_GAP_ROWS) : 1;

  for (const item of ordered) {
    const rows = item.mobile.rows > 0 ? item.mobile.rows : item.desktop.rows;
    out.set(
      item.id,
      snapBox({
        col: 1,
        span: 12,
        row,
        rows,
      }),
    );
    row += rows + MOBILE_STACK_GAP_ROWS;
  }
  return out;
}

/** Append one new auto item below the current mobile stack in a section. */
export function appendMobileStack(
  existing: StackItem[],
  newItem: { id: string; rows: number },
): GridBox {
  const boxes = existing.map((i) => i.mobile);
  const start = rowBelow(boxes, existing.length ? MOBILE_STACK_GAP_ROWS : 0);
  return snapBox({ col: 1, span: 12, row: start, rows: newItem.rows });
}
