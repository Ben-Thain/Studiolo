import { describe, expect, it } from "vitest";
import { GRID_COLUMNS, legacy12To96 } from "@/editor/grid";

describe("legacy12To96", () => {
  it("maps the full row and the documented pair", () => {
    expect(legacy12To96({ col: 1, span: 12 })).toEqual({ col: 1, span: 96 });
    expect(legacy12To96({ col: 7, span: 6 })).toEqual({ col: 50, span: 47 });
  });

  it("keeps every legacy pair inside 1..96 and within 8 design px", () => {
    const u = 1376 / GRID_COLUMNS;
    for (let col = 1; col <= 12; col += 1) {
      for (let span = 1; span <= 13 - col; span += 1) {
        const next = legacy12To96({ col, span });
        expect(next.col).toBeGreaterThanOrEqual(1);
        expect(next.col + next.span - 1).toBeLessThanOrEqual(96);
        const oldStart = (col - 1) * (92.6667 + 24);
        const oldEnd = oldStart + span * 92.6667 + (span - 1) * 24;
        const newStart = (next.col - 1) * u;
        const newEnd = (next.col - 1 + next.span) * u;
        expect(Math.abs(newStart - oldStart)).toBeLessThanOrEqual(8);
        expect(Math.abs(newEnd - oldEnd)).toBeLessThanOrEqual(8);
      }
    }
  });
});
