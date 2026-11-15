import { describe, expect, it } from "vitest";
import { authHref, safeNext, sameOrigin } from "@/lib/auth/next";

describe("safeNext", () => {
  it.each([
    ["/sites", "/sites"],
    ["/sites/abc/pages?tab=1#x", "/sites/abc/pages?tab=1#x"],
    ["/account", "/account"],
    ["/", "/"],
    ["/sites/./abc", "/sites/abc"],
    ["/sites?q=100%25", "/sites?q=100%25"],
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
    // dot segments that normalise to a protocol-relative URL
    "/.//evil.com",
    "/..//evil.com",
    "/%2e%2e//evil.com",
    "/%2E%2E//evil.com",
    "/x/..//evil.com",
    "/%252e%252e//evil.com",
    "/%25252e%25252e//evil.com",
    "/./\\evil.com",
    "/%2f/evil.com",
    "/%5c/evil.com",
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

describe("sameOrigin", () => {
  it("accepts a path on the origin", () => {
    expect(sameOrigin("/sites", "https://app.example")).toBe(true);
  });
  it.each(["//evil.com", "https://evil.com/", "/\\evil.com"])(
    "rejects %s",
    (path) => expect(sameOrigin(path, "https://app.example")).toBe(false),
  );
});

describe("safeNext output never leaves the origin", () => {
  it.each([
    "/.//evil.com",
    "/..//evil.com",
    "/%2e%2e//evil.com",
    "/x/..//evil.com",
    "/%252e%252e//evil.com",
    "/sites",
    "/sites/x/../y",
  ])("%s", (input) => {
    let value: string | null = input;
    // Each hop through a URL decodes once.
    for (let hop = 0; hop < 3 && value; hop += 1) {
      value = safeNext(value);
      if (value) {
        expect(sameOrigin(value, "https://app.example")).toBe(true);
        value = decodeURIComponent(value);
      }
    }
  });
});
