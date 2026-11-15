import { describe, expect, it } from "vitest";
import { isAppHost, isAppRoute, isAuthRoute } from "@/lib/auth/routes";

describe("isAuthRoute", () => {
  it.each(["/sites", "/sites/abc", "/sites/abc/pages", "/account", "/plan"])(
    "%s needs auth",
    (path) => expect(isAuthRoute(path)).toBe(true),
  );
  it.each(["/", "/login", "/signup", "/auth/callback", "/sitesx", "/planner"])(
    "%s is public",
    (path) => expect(isAuthRoute(path)).toBe(false),
  );
});

describe("isAppRoute", () => {
  it.each([
    "/",
    "/login",
    "/signup",
    "/auth/callback",
    "/auth/expired",
    "/sites",
    "/plan",
  ])("%s is an app route", (path) => expect(isAppRoute(path)).toBe(true));
  it.each(["/about", "/dev/components", "/authx"])("%s is not", (path) =>
    expect(isAppRoute(path)).toBe(false),
  );
});

describe("isAppHost", () => {
  const env = {
    appUrl: "https://app.studiolo.page",
    rootDomain: "studiolo.page",
  };
  it.each([
    "app.studiolo.page",
    "studiolo.page",
    "localhost:3000",
    "127.0.0.1:3000",
    "studiolo-git-main-ben.vercel.app",
  ])("%s is the app", (host) => expect(isAppHost(host, env)).toBe(true));
  it.each(["ben.studiolo.page", "www.example.com", "", null])(
    "%j is a tenant or unknown host",
    (host) => expect(isAppHost(host, env)).toBe(false),
  );
});
