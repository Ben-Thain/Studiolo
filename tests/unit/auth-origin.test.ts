import { describe, expect, it } from "vitest";
import { callbackOrigin, type OriginInput } from "@/lib/auth/origin";

const prod: OriginInput = {
  host: "app.studiolo.page",
  forwardedProto: "https",
  requestProtocol: "https:",
  nodeEnv: "production",
  appUrl: "https://app.studiolo.page",
  vercelUrl: "studiolo-abc123-ben.vercel.app",
  vercelBranchUrl: "studiolo-git-main-ben.vercel.app",
};

const dev: OriginInput = {
  host: "127.0.0.1:3000",
  forwardedProto: null,
  requestProtocol: "http:",
  nodeEnv: "development",
  appUrl: "http://127.0.0.1:3000",
};

describe("callbackOrigin in production", () => {
  it("uses the app URL", () => {
    expect(callbackOrigin(prod)).toBe("https://app.studiolo.page");
  });
  it.each([
    "evil.vercel.app",
    "evil.com",
    "localhost:6666",
    "app.studiolo.page.evil.com",
    "",
  ])("ignores a forged host %j", (host) => {
    expect(callbackOrigin({ ...prod, host })).toBe("https://app.studiolo.page");
  });
  it("keeps this deployment's own Vercel URLs", () => {
    expect(
      callbackOrigin({ ...prod, host: "studiolo-abc123-ben.vercel.app" }),
    ).toBe("https://studiolo-abc123-ben.vercel.app");
    expect(
      callbackOrigin({ ...prod, host: "studiolo-git-main-ben.vercel.app" }),
    ).toBe("https://studiolo-git-main-ben.vercel.app");
  });
  it("never uses a forwarded http scheme", () => {
    expect(
      callbackOrigin({
        ...prod,
        host: "studiolo-abc123-ben.vercel.app",
        forwardedProto: "http",
      }),
    ).toBe("https://studiolo-abc123-ben.vercel.app");
  });
});

describe("callbackOrigin in development", () => {
  it("accepts the app host and the loopback alias on the same port", () => {
    expect(callbackOrigin(dev)).toBe("http://127.0.0.1:3000");
    expect(callbackOrigin({ ...dev, host: "localhost:3000" })).toBe(
      "http://localhost:3000",
    );
  });
  it.each(["localhost:6666", "evil.vercel.app", "evil.com", "127.0.0.1:3001"])(
    "falls back to the app URL for %s",
    (host) => {
      expect(callbackOrigin({ ...dev, host })).toBe("http://127.0.0.1:3000");
    },
  );
  it("ignores a non-http forwarded scheme", () => {
    expect(callbackOrigin({ ...dev, forwardedProto: "javascript" })).toBe(
      "http://127.0.0.1:3000",
    );
  });
});
