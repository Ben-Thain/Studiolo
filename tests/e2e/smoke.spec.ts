import { expect, test } from "@playwright/test";

test("GET / returns 200", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Studiolo");
});

test("home renders the landing page", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "A stunning personal website, in 5 minutes.",
    }),
  ).toBeVisible();
});
