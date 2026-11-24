import { describe, expect, it } from "vitest";
import { mobileFontSize } from "@/editor/fonts";

describe("mobileFontSize", () => {
  it("never drops below 16", () => {
    expect(mobileFontSize(13)).toBe(16);
    expect(mobileFontSize(16)).toBe(16);
    expect(mobileFontSize(32)).toBe(24);
    expect(mobileFontSize(48)).toBe(32);
  });
});
