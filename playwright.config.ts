import { createHmac } from "node:crypto";
import { defineConfig } from "@playwright/test";

// e2e runs against local stand-ins only: a mock of Supabase Auth and the API
// gateway (tests/e2e/mock-auth-server.mjs) in front of a local PostgREST on a
// throwaway local database (scripts/e2e-stack.sh resets studiolo_e2e with the
// migrations and the seed). No hosted project, email or Google.
const MOCK_AUTH_PORT = 54399;
const POSTGREST_PORT = 54398;
const APP_URL = "http://127.0.0.1:3000";

// A service-role token for the local stack only, signed with the test-only
// key shared with scripts/e2e-stack.sh and the mock. Not a secret: it opens
// nothing but the throwaway studiolo_e2e database.
function localServiceRoleKey() {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${part({ alg: "HS256", typ: "JWT" })}.${part({ role: "service_role", iss: "studiolo-e2e" })}`;
  const signature = createHmac(
    "sha256",
    "studiolo-local-e2e-only-jwt-signing-key-0001",
  )
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: APP_URL,
  },
  projects: [
    { name: "main", testIgnore: /auth-google-off\.spec\.ts/ },
    // Flips server-wide mock state, so it runs alone after everything else.
    {
      name: "google-off",
      testMatch: /auth-google-off\.spec\.ts/,
      dependencies: ["main"],
    },
  ],
  webServer: [
    {
      command: "bash scripts/e2e-stack.sh",
      url: `http://127.0.0.1:${POSTGREST_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { POSTGREST_PORT: String(POSTGREST_PORT) },
    },
    {
      command: "node tests/e2e/mock-auth-server.mjs",
      url: `http://127.0.0.1:${MOCK_AUTH_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        MOCK_AUTH_PORT: String(MOCK_AUTH_PORT),
        POSTGREST_PORT: String(POSTGREST_PORT),
      },
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_AUTH_PORT}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
        NEXT_PUBLIC_APP_URL: APP_URL,
        NEXT_PUBLIC_ROOT_DOMAIN: "127.0.0.1:3000",
        SUPABASE_SERVICE_ROLE_KEY: localServiceRoleKey(),
      },
    },
  ],
});
