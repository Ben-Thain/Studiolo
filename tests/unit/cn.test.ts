import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("lets the later colour class win", () => {
    expect(cn("text-ink", "text-error")).toBe("text-error");
  });

  it("merges radii and shadows", () => {
    expect(cn("rounded-control", "rounded-pop")).toBe("rounded-pop");
    expect(cn("shadow-pop", "shadow-dialog")).toBe("shadow-dialog");
  });
});
