import { describe, expect, it } from "vitest";
import { authHref, safeNext } from "@/lib/auth/next";

describe("safeNext", () => {
  it.each([
    ["/sites", "/sites"],
    ["/sites/abc/pages?tab=1#x", "/sites/abc/pages?tab=1#x"],
    ["/account", "/account"],
    ["/", "/"],
  ])("keeps same-origin relative path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "sites",
    "//evil.com",
    "//evil.com/sites",
    "/\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "https://evil.com",
    "http:/evil.com",
    "javascript:alert(1)",
    " //evil.com",
    `/${"a".repeat(2050)}`,
  ])("ignores %j", (input) => {
    expect(safeNext(input as string | null | undefined)).toBeNull();
  });
});

describe("authHref", () => {
  it("adds an encoded safe next", () => {
    expect(authHref("/login", "/sites?x=1")).toBe(
      "/login?next=%2Fsites%3Fx%3D1",
    );
  });
  it("drops an unsafe next", () => {
    expect(authHref("/signup", "//evil.com")).toBe("/signup");
    expect(authHref("/login", null)).toBe("/login");
  });
});
