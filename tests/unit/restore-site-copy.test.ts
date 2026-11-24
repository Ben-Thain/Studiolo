import { describe, expect, it } from "vitest";
import { SITES_COPY } from "@/lib/sites/copy";

describe("restore copy", () => {
  it("uses the expired message when a site was purged", () => {
    expect(SITES_COPY.restoreExpired).toBe(
      "This site can't be restored any more.",
    );
  });

  it("uses the already-in-sites message for a second restore", () => {
    expect(SITES_COPY.restoreAlready("North Light")).toBe(
      "North Light is already in Sites.",
    );
  });
});
