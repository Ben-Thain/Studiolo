/**
 * Mobile auto-stack for one section's elements (prompt 05). Reading order is
 * desktop row, then column, then sort order. Each item is full width with a
 * 3-row gap between elements.
 */

import { MOBILE_STACK_GAP_ROWS, snapBox } from "./grid";
import type { GridBox } from "./types";

export type StackItem = {
  id: string;
  sortOrder: number;
  desktop: GridBox;
};

export function autoStack(items: StackItem[]): Map<string, GridBox> {
  const ordered = [...items].sort(
    (a, b) =>
      a.desktop.row - b.desktop.row ||
      a.desktop.col - b.desktop.col ||
      a.sortOrder - b.sortOrder,
  );
  const out = new Map<string, GridBox>();
  let row = 1;
  for (const item of ordered) {
    out.set(
      item.id,
      snapBox({
        col: 1,
        span: 12,
        row,
        rows: item.desktop.rows,
      }),
    );
    row += item.desktop.rows + MOBILE_STACK_GAP_ROWS;
  }
  return out;
}