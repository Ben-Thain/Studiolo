import { describe, expect, it } from "vitest";
import {
  DESIGN_WIDTH,
  GRID_GUTTER,
  columnWidthPx,
  gridDeltaFromPixelBox,
  pixelsToGridDelta,
} from "@/lib/editor/stage-coords";

describe("editor stage coords", () => {
  it("converts pixel deltas at full and half design scale", () => {
    const full = columnWidthPx(DESIGN_WIDTH, GRID_GUTTER);
    const half = columnWidthPx(DESIGN_WIDTH / 2, GRID_GUTTER / 2);
    expect(pixelsToGridDelta(full * 2, 24, full, 8)).toEqual({
      dCol: 2,
      dRow: 3,
    });
    expect(pixelsToGridDelta(half * 3, 16, half, 8)).toEqual({
      dCol: 3,
      dRow: 2,
    });
  });

  it("derives span and rows from a pixel box", () => {
    const col = columnWidthPx();
    const box = gridDeltaFromPixelBox(
      col * 4 + GRID_GUTTER * 3,
      80,
      col,
      8,
      GRID_GUTTER,
    );
    expect(box.span).toBe(4);
    expect(box.rows).toBe(10);
  });
});
