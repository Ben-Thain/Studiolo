import { describe, expect, it } from "vitest";
import { autofitRows } from "@/editor/textFit";

describe("text autofit", () => {
  it("grows to the measured height and never shrinks below the user's rows", () => {
    expect(autofitRows(6, 80)).toBe(10);
    expect(autofitRows(6, 20)).toBe(6);
    expect(autofitRows(12, 40)).toBe(12);
  });
});
