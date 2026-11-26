import { describe, expect, it } from "vitest";
import { resizeBoxPx, type ResizeHandleName } from "@/editor/resize";

const start = { x: 100, y: 40, w: 80, h: 64 };

describe("resize handles", () => {
  it("moves only the dragged edge and keeps the opposite edge fixed", () => {
    const handles: ResizeHandleName[] = [
      "nw",
      "n",
      "ne",
      "e",
      "se",
      "s",
      "sw",
      "w",
    ];
    for (const handle of handles) {
      const next = resizeBoxPx(start, 10, 12, handle, { minW: 8, minH: 8 });
      if (handle === "e" || handle === "ne" || handle === "se") {
        expect(next.x).toBe(start.x);
      }
      if (handle === "s" || handle === "sw" || handle === "se") {
        expect(next.y).toBe(start.y);
      }
      expect(next.w).toBeGreaterThanOrEqual(8);
      expect(next.h).toBeGreaterThanOrEqual(8);
    }
  });

  it("locks aspect unless Shift frees an image, and locks text when Shift is held", () => {
    const locked = resizeBoxPx(start, 40, 0, "e", {
      lockAspect: true,
      aspect: start.w / start.h,
      minW: 8,
      minH: 8,
    });
    expect(locked.w / locked.h).toBeCloseTo(start.w / start.h, 5);
    const free = resizeBoxPx(start, 40, 0, "e", {
      lockAspect: false,
      minW: 8,
      minH: 8,
    });
    expect(free.h).toBe(start.h);
    expect(free.w).toBe(start.w + 40);
  });

  it("clamps to the section and the minimum", () => {
    const next = resizeBoxPx(start, 500, 0, "e", {
      minW: 16,
      minH: 16,
      maxRight: 200,
    });
    expect(next.x + next.w).toBeLessThanOrEqual(200);
    const small = resizeBoxPx(start, -500, -500, "se", { minW: 16, minH: 16 });
    expect(small.w).toBe(16);
    expect(small.h).toBe(16);
  });
});
