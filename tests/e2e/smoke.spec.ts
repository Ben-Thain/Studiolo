import { expect, test } from "@playwright/test";

test("GET / returns 200", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Studiolo");
});

test("home renders the Studiolo placeholder", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Studiolo" })).toBeVisible();
});
