import { describe, expect, it } from "vitest";
import { deriveSlug, isValidSlug, withSuffix } from "@/lib/sites/slug";

describe("deriveSlug", () => {
  it("lowercases, folds accents and dashes everything else", () => {
    expect(deriveSlug("Riverton House")).toBe("riverton-house");
    expect(deriveSlug("Café Élan")).toBe("cafe-elan");
    expect(deriveSlug("  Straße & Søn!! ")).toBe("strasse-son");
    expect(deriveSlug("North---Light__2026")).toBe("north-light-2026");
  });

  it("cuts to 40 without a trailing dash", () => {
    const slug = deriveSlug(`${"a".repeat(39)} b`);
    expect(slug).toBe("a".repeat(39));
    expect(deriveSlug("x".repeat(60))).toHaveLength(40);
  });

  it("pads short results with -site", () => {
    expect(deriveSlug("Al")).toBe("al-site");
    expect(deriveSlug("Q")).toBe("q-site");
    expect(deriveSlug("東京")).toBe("site");
    expect(isValidSlug(deriveSlug("!"))).toBe(true);
  });

  it("always derives a valid slug from a non-empty name", () => {
    for (const name of ["Mara Lind", "é", "--x--", "A B C", "2026"]) {
      expect(isValidSlug(deriveSlug(name))).toBe(true);
    }
  });
});

describe("isValidSlug", () => {
  it("matches the sites_slug_format rule", () => {
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("a".repeat(40))).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("a".repeat(41))).toBe(false);
    expect(isValidSlug("-abc")).toBe(false);
    expect(isValidSlug("abc-")).toBe(false);
    expect(isValidSlug("Abc")).toBe(false);
    expect(isValidSlug("ab_c")).toBe(false);
  });
});

describe("withSuffix", () => {
  it("appends -n and keeps within 40", () => {
    expect(withSuffix("north-light", 2)).toBe("north-light-2");
    expect(withSuffix("a".repeat(40), 2)).toBe(`${"a".repeat(38)}-2`);
    expect(withSuffix(`${"a".repeat(37)}-bb`, 10)).toBe(`${"a".repeat(37)}-10`);
  });
});
