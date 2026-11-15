import { defineConfig } from "@playwright/test";

// e2e runs against a local mock of Supabase Auth (tests/e2e/mock-auth-server.mjs)
// so sign-in flows are testable with no hosted project, email or Google.
const MOCK_AUTH_PORT = 54399;
const APP_URL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: APP_URL,
  },
  webServer: [
    {
      command: "node tests/e2e/mock-auth-server.mjs",
      url: `http://127.0.0.1:${MOCK_AUTH_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { MOCK_AUTH_PORT: String(MOCK_AUTH_PORT) },
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
      },
    },
  ],
});
