import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const MOCK = "http://127.0.0.1:54399";
const UUID = "[0-9a-f-]{36}";
const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);

function uniqueEmail(tag: string) {
  return `${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
}

async function signIn(page: Page, email: string) {
  const tokenHash = `ok.${Buffer.from(email).toString("base64url")}`;
  await page.goto(
    `/auth/callback?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent("/sites")}`,
  );
  await expect(page).toHaveURL("/sites");
}

test.describe("templates", () => {
  test("desktop: preview Still, create, replace a sample, then start blank", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, uniqueEmail("tpl"));
    await page.getByRole("radio", { name: "Still, Photographer" }).click();
    await page.getByRole("link", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeHidden();
    await expect(page.getByText("Inês Calado").first()).toBeVisible();
    const pageSelect = page.getByLabel("Page");
    await expect(pageSelect).toHaveAttribute("data-hydrated", "");
    await pageSelect.selectOption({ label: "About" });
    await expect(page.getByText("I grew up in Viana")).toBeVisible();
    await page.getByRole("button", { name: "Mobile", exact: true }).click();
    await page.getByRole("button", { name: "Use this template" }).click();
    await page.getByRole("textbox", { name: "Site name" }).fill("Hollin Field");
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page).toHaveURL(new RegExp(`/sites/${UUID}/editor/${UUID}`), {
      timeout: 60_000,
    });
    await expect(page.getByText("Hollin Field").first()).toBeVisible();
    await expect(page.getByText(/is ready/)).toBeVisible();
    await expect(
      page.getByText("Photographs of the Atlantic coast"),
    ).toBeVisible();

    const hero = page
      .locator("[data-element]")
      .filter({ has: page.locator("img") })
      .first();
    await hero.click();
    const chip = page.getByRole("button", { name: "Replace image" }).first();
    await expect(chip).toBeVisible();
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(FIXTURES, "wide.jpg"));
    await expect(
      page.getByRole("button", { name: "Replace image" }),
    ).toHaveCount(1, {
      timeout: 30_000,
    });

    const heading = page.getByText("Photographs of the Atlantic coast");
    await heading.dblclick();
    await page.keyboard.type("Hello coast");
    await page.getByRole("radio", { name: "Desktop" }).click();
    await expect(page.getByText("Hello coast")).toBeVisible();
    await expect(
      page.getByText("Photographs of the Atlantic coast"),
    ).toHaveCount(0);

    await page.goto("/sites");
    await page.getByRole("button", { name: "New site" }).click();
    await expect(
      page.getByRole("radio", { name: /Start blank/ }),
    ).toBeChecked();
    const dialog = page.getByRole("dialog", { name: "New site" });
    await dialog.getByRole("textbox", { name: "Site name" }).fill("Blank Yard");
    await dialog.getByRole("button", { name: "Create site" }).click();
    await expect(page).toHaveURL(new RegExp(`/editor/${UUID}`), {
      timeout: 30_000,
    });
    await expect(page.getByText("Your heading")).toBeVisible();
    void request;
  });

  test("phone: Linen preview then create", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 393, height: 852 });
    await signIn(page, uniqueEmail("tplm"));
    await page.goto("/sites?new=1");
    await page
      .locator(".fixed")
      .getByRole("radio", { name: "Linen, Interior studio" })
      .click();
    await expect(
      page.getByRole("button", { name: "Use this template" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Use this template" }).click();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();
    await page.getByRole("textbox", { name: "Site name" }).fill("Hartley");
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page).toHaveURL(new RegExp(`/editor/${UUID}`), {
      timeout: 60_000,
    });
    await expect(page.getByText("Calm, lasting rooms")).toBeVisible();
  });

  test("a failed create leaves no site and no objects", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, uniqueEmail("fail-create"));
    const before = await request
      .get(`${MOCK}/__objects?prefix=`)
      .then((res) => res.json());
    await page.route("**/rest/v1/rpc/create_site", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "failed", code: "500" }),
      }),
    );
    await page.getByRole("textbox", { name: "Site name" }).fill("Broken Site");
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page.getByText("We couldn't create your site.")).toBeVisible();
    await expect(page).toHaveURL("/sites");
    const after = await request
      .get(`${MOCK}/__objects?prefix=`)
      .then((res) => res.json());
    expect(after).toEqual(before);
  });
});
