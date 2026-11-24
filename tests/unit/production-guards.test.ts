import { afterEach, describe, expect, it, vi } from "vitest";

describe("production guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides /dev/editor in production builds", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("next/navigation", () => ({
      notFound: () => {
        throw new Error("NOT_FOUND");
      },
    }));
    const { default: DevEditorPage } = await import("@/app/dev/editor/page");
    await expect(DevEditorPage()).rejects.toThrow("NOT_FOUND");
    vi.doUnmock("next/navigation");
  });

  it("hides /api/e2e/restore-site in production builds", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_STACK", "1");
    const { POST } = await import("@/app/api/e2e/restore-site/route");
    const res = await POST(
      new Request("http://127.0.0.1/api/e2e/restore-site", {
        method: "POST",
        body: JSON.stringify({
          siteId: "40000000-0000-4000-8000-000000000011",
        }),
      }),
    );
    expect(res.status).toBe(404);
  });
});
