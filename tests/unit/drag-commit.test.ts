import { describe, expect, it } from "vitest";
import { commitBox, pxToUnits } from "@/editor/drag";
import { ROW_UNIT_PX } from "@/editor/grid";

describe("drag commit", () => {
  it("rounds to the nearest unit and never moves more than half a unit", () => {
    const unit = 1376 / 96;
    for (let px = 0; px < 400; px += 3) {
      const rounded = pxToUnits(px, unit);
      expect(Math.abs(rounded - px)).toBeLessThanOrEqual(unit / 2 + 1e-6);
      const row = pxToUnits(px, ROW_UNIT_PX);
      expect(Math.abs(row - px)).toBeLessThanOrEqual(ROW_UNIT_PX / 2 + 1e-6);
    }
  });

  it("turns a design-pixel box into column and row indexes", () => {
    const unit = 1376 / 96;
    expect(commitBox({ x: 0, y: 0, w: unit * 4, h: 32 }, unit)).toEqual({
      col: 1,
      span: 4,
      row: 1,
      rows: 4,
    });
  });
});
