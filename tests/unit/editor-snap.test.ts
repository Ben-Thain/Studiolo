import { describe, expect, it } from "vitest";
import {
  snapLayout,
  snapToElement,
  snapToGrid,
  snapToSection,
} from "@/editor/grid";

describe("snap", () => {
  const box = { col: 2.4, span: 5.2, row: 3.1, rows: 6.7 };

  it("snaps to the grid", () => {
    const { box: snapped, readout } = snapToGrid(box);
    expect(snapped).toEqual({ col: 2, span: 5, row: 3, rows: 7 });
    expect(readout.label).toBeTruthy();
  });

  it("snaps to a peer element edge", () => {
    const target = { col: 7, span: 6, row: 1, rows: 4 };
    const { box: snapped, guides } = snapToElement(
      { col: 6.6, span: 1, row: 1, rows: 4 },
      target,
      0.5,
    );
    expect(snapped.col).toBe(7);
    expect(guides.some((g) => g.label === "edge")).toBe(true);
  });

  it("snaps to section bounds and centers", () => {
    const section = { col: 1, span: 12, row: 1, rows: 50 };
    const { guides, readout } = snapToSection(
      { col: 6.4, span: 4, row: 25.3, rows: 8 },
      section,
      0.5,
    );
    expect(guides.length).toBeGreaterThan(0);
    expect(readout).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      w: expect.any(Number),
      h: expect.any(Number),
    });
  });

  it("combines grid, element and section guides", () => {
    const peers = [{ col: 1, span: 6, row: 5, rows: 4 }];
    const section = { col: 1, span: 12, row: 1, rows: 40 };
    const result = snapLayout(box, peers, { section, threshold: 0.5 });
    expect(result.guides.length).toBeGreaterThan(0);
    expect(result.readout.label.length).toBeGreaterThan(0);
  });
});
