import { ROW_UNIT_PX } from "@/editor/grid";
import type { SizeStep } from "@/editor/types";

export function lineHeightForSizeStep(size: SizeStep): number {
  if (size >= 48) return 1.1;
  if (size >= 28) return 1.12;
  return 1.5;
}

/** Estimate grid row span from text content and font size. */
export function textRowsForContent(text: string, fontSize: SizeStep): number {
  const linePx = lineHeightForSizeStep(fontSize) * fontSize;
  const lines = text.split("\n").filter((line, index, all) => {
    if (line.length > 0) return true;
    return index < all.length - 1;
  });
  const count = Math.max(1, lines.length);
  return Math.max(1, Math.ceil((count * linePx) / ROW_UNIT_PX));
}
