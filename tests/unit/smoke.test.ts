import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("smoke", () => {
  it("joins class names and drops empty parts", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
