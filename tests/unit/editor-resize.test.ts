import { describe, expect, it } from "vitest";
import { resizeFromCorner } from "@/editor/resize";

describe("resizeFromCorner", () => {
  const start = { col: 7, span: 6, row: 1, rows: 40 };

  it("anchors the top-left drag on the bottom-right corner", () => {
    expect(resizeFromCorner(start, -2, 10, "nw")).toEqual({
      col: 5,
      span: 8,
      row: 11,
      rows: 30,
    });
  });

  it("grows right and down from the bottom-right handle", () => {
    expect(resizeFromCorner(start, -2, 10, "se")).toEqual({
      col: 7,
      span: 4,
      row: 1,
      rows: 50,
    });
  });

  it("moves the left edge from the bottom-left handle and the top edge from the top-right", () => {
    expect(resizeFromCorner(start, -2, 10, "sw")).toEqual({
      col: 5,
      span: 8,
      row: 1,
      rows: 50,
    });
    expect(resizeFromCorner(start, 2, 10, "ne")).toEqual({
      col: 7,
      span: 6,
      row: 11,
      rows: 30,
    });
  });

  it("clamps a left drag so the box stays on the grid", () => {
    expect(resizeFromCorner(start, -20, -20, "nw")).toEqual({
      col: 1,
      span: 12,
      row: 1,
      rows: 40,
    });
  });
});
