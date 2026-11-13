import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readPublicEnv } from "@/lib/env";
import { readServerEnv } from "@/lib/env.server";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("readPublicEnv", () => {
  it("uses localhost defaults outside production", () => {
    const env = readPublicEnv({ NODE_ENV: "test" });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_ROOT_DOMAIN).toBe("localhost:3000");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("");
    expect(env.NEXT_PUBLIC_WILDCARD_READY).toBe("");
  });

  it("fails fast with a readable message when a required public var is missing in production", () => {
    expect(() =>
      readPublicEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_ROOT_DOMAIN: "studiolo.page",
      }),
    ).toThrow(
      /Missing required public environment variable: NEXT_PUBLIC_APP_URL/,
    );
  });

  it("names every missing required public var in production", () => {
    expect(() => readPublicEnv({ NODE_ENV: "production" })).toThrow(
      /Missing required public environment variables: NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_ROOT_DOMAIN/,
    );
  });

  it("accepts the required public vars in production", () => {
    const env = readPublicEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://studiolo.page",
      NEXT_PUBLIC_ROOT_DOMAIN: "studiolo.page",
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://studiolo.page");
    expect(env.NEXT_PUBLIC_ROOT_DOMAIN).toBe("studiolo.page");
  });

  it("rejects a public root domain that includes a protocol", () => {
    expect(() =>
      readPublicEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://studiolo.page",
        NEXT_PUBLIC_ROOT_DOMAIN: "https://studiolo.page",
      }),
    ).toThrow(/NEXT_PUBLIC_ROOT_DOMAIN/);
  });
});

describe("readServerEnv", () => {
  it("reads empty server values without throwing", () => {
    const env = readServerEnv({});
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("");
    expect(env.VERCEL_TOKEN).toBe("");
    expect(env.DOMAINS_DRY_RUN).toBe("");
  });

  it("rejects a dry-run flag other than 1 without echoing the value", () => {
    expect(() => readServerEnv({ DOMAINS_DRY_RUN: "yes" })).toThrow(
      /DOMAINS_DRY_RUN/,
    );
    try {
      readServerEnv({ DOMAINS_DRY_RUN: "yes" });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain("yes");
    }
  });
});

describe("env module boundary", () => {
  it("keeps server key names out of the public env module", () => {
    const source = readFileSync(path.join(root, "src/lib/env.ts"), "utf8");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("VERCEL_TOKEN");
    expect(source).not.toContain("SITE_GATE_SECRET");
    expect(source).not.toContain("IP_HASH_SALT");
    expect(source).not.toContain("CRON_SECRET");
    expect(source).not.toContain("RESEND_API_KEY");
    expect(source).not.toContain("DOMAINS_DRY_RUN");
  });

  it("marks the server env module as server-only", () => {
    const source = readFileSync(
      path.join(root, "src/lib/env.server.ts"),
      "utf8",
    );
    expect(source).toContain('import "server-only"');
  });
});
