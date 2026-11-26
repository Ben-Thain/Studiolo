import { describe, expect, it } from "vitest";
import {
  RESERVED_PAGE_SLUGS,
  derivePageSlug,
  isReservedPageSlug,
  isValidPageSlug,
  pageSlugError,
} from "@/lib/sites/page-slug";

describe("page slugs", () => {
  it("derives a 1–50 character address", () => {
    expect(derivePageSlug("Journal")).toBe("journal");
    expect(derivePageSlug("A")).toBe("a");
    expect(derivePageSlug("x".repeat(80)).length).toBeLessThanOrEqual(50);
  });

  it("reserves app paths, including the template preview", () => {
    for (const slug of RESERVED_PAGE_SLUGS) {
      expect(isReservedPageSlug(slug)).toBe(true);
      expect(isValidPageSlug(slug)).toBe(false);
    }
    expect(pageSlugError("templates")).toBe("That address is reserved.");
    expect(isValidPageSlug("journal")).toBe(true);
  });
});
