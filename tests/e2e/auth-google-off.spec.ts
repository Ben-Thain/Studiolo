import { expect, test } from "@playwright/test";

// Runs as its own Playwright project after every other test, because it
// switches the mock's Google provider off for the whole server.
const MOCK = "http://127.0.0.1:54399";

test.describe.configure({ mode: "serial" });

test.afterAll(async ({ request }) => {
  await request.post(`${MOCK}/__google?enabled=true`);
});

test("with Google off, the button says it isn't set up yet", async ({
  page,
}) => {
  await page.request.post(`${MOCK}/__google?enabled=false`);
  for (const path of ["/login", "/signup", "/auth/expired"]) {
    await page.goto(path);
    const button = page.getByRole("button", {
      name: "Google sign-in isn't set up yet",
    });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toHaveCount(0);
  }
});

test("with Google on again, Continue with Google is back", async ({ page }) => {
  await page.request.post(`${MOCK}/__google?enabled=true`);
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
});
