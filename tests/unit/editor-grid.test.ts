import { describe, expect, it } from "vitest";
import {
  GRID_COLUMNS,
  ROW_UNIT_PX,
  boxesOverlap,
  defaultDesktopSpan,
  rowBelow,
  snapBox,
} from "@/editor/grid";
import { GRID_AUTO_ROWS, gridPlacement } from "@/editor/renderGrid";

describe("grid", () => {
  it("uses 12 columns and an 8px row unit", () => {
    expect(GRID_COLUMNS).toBe(96);
    expect(ROW_UNIT_PX).toBe(8);
    expect(GRID_AUTO_ROWS).toBe("minmax(8px, auto)");
  });

  it("snaps boxes into the grid", () => {
    expect(snapBox({ col: 1.2, span: 6.8, row: 2.1, rows: 4.6 })).toEqual({
      col: 1,
      span: 7,
      row: 2,
      rows: 5,
    });
  });

  it("defaults new text to columns 1–6 and images to 7–12", () => {
    expect(defaultDesktopSpan("text")).toEqual({ col: 1, span: 47 });
    expect(defaultDesktopSpan("image")).toEqual({ col: 50, span: 47 });
  });

  it("detects overlap", () => {
    const a = { col: 1, span: 6, row: 1, rows: 4 };
    const b = { col: 7, span: 6, row: 1, rows: 4 };
    expect(boxesOverlap(a, b)).toBe(false);
    expect(boxesOverlap(a, { col: 4, span: 4, row: 2, rows: 2 })).toBe(true);
  });

  it("rowBelow leaves a gap", () => {
    expect(rowBelow([{ col: 1, span: 6, row: 5, rows: 10 }], 3)).toBe(18);
  });
});

describe("renderGrid", () => {
  it("outputs server-safe grid placement styles", () => {
    expect(gridPlacement({ col: 7, span: 6, row: 1, rows: 40 })).toEqual({
      gridColumn: "7 / span 6",
      gridRow: "1 / span 40",
      zIndex: 1,
    });
  });
});
