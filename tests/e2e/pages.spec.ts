import { expect, test, type Page } from "@playwright/test";

const UUID = "[0-9a-f-]{36}";
const SHOTS = "/opt/cursor/artifacts/07";

function uniqueEmail(tag: string) {
  return `${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
}

async function signIn(page: Page) {
  const email = uniqueEmail("pages");
  const tokenHash = `ok.${Buffer.from(email).toString("base64url")}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `/auth/callback?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent("/sites")}`,
  );
  await expect(page).toHaveURL("/sites");
}

async function createFrom(page: Page, template: string, name: string) {
  await page.getByRole("radio", { name: template }).click();
  await page.getByRole("textbox", { name: "Site name" }).fill(name);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page).toHaveURL(new RegExp(`/sites/${UUID}/editor/${UUID}`), {
    timeout: 60_000,
  });
  const siteId = page.url().match(/sites\/([0-9a-f-]{36})/)?.[1];
  if (!siteId) throw new Error("site id");
  return siteId;
}

async function pickerLabels(page: Page) {
  await page.locator("[data-page-picker]").click();
  const labels = await page.getByRole("menuitem").allTextContents();
  await page.keyboard.press("Escape");
  return labels.map((label) => label.trim());
}

test.describe("pages", () => {
  test("still: create, hide, reorder, home, rename, delete", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signIn(page);
    const siteId = await createFrom(
      page,
      "Still, Photographer",
      `Pages ${Math.random().toString(36).slice(2, 6)}`,
    );
    await page.getByText("Atlantic, 2025").click();
    const linkBefore = await page
      .getByRole("textbox", { name: "Link" })
      .inputValue();
    expect(linkBefore).toMatch(/[0-9a-f-]{36}/);

    await page.goto(`/sites/${siteId}/pages`);
    await expect(page.getByRole("heading", { name: "Pages" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-pages.png` });
    await page.getByRole("button", { name: "New page" }).click();
    await page.getByRole("textbox", { name: "Title" }).fill("Press");
    await expect(page.getByText("/press")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/02-new-page.png` });
    await page.getByRole("button", { name: "Create page" }).click();
    await expect(page).toHaveURL(new RegExp(`/sites/${siteId}/editor/${UUID}`));
    await expect(page.getByRole("button", { name: "Press" })).toBeVisible();

    await page.goto(`/sites/${siteId}/pages`);
    const table = page.locator("table");
    await table.getByRole("switch", { name: "Press in menu" }).click();
    await expect(
      table.getByRole("switch", { name: "Press in menu" }),
    ).toHaveAttribute("aria-checked", "false");

    const grip = table.getByRole("button", { name: "Reorder Press" });
    const about = table.getByRole("button", { name: "Reorder About" });
    const from = await grip.boundingBox();
    const to = await about.boundingBox();
    if (!from || !to) throw new Error("grip");
    await page.mouse.move(from.x + 12, from.y + 12);
    await page.mouse.down();
    await page.mouse.move(to.x + 12, to.y + 8, { steps: 12 });
    await page.mouse.up();

    await page.getByRole("link", { name: "Open editor" }).click();
    await expect(page.locator("[data-element='Navigation']")).toBeVisible();
    await expect(page.locator("[data-element='Navigation']")).not.toContainText(
      "Press",
    );
    const afterHide = await pickerLabels(page);
    const pressAt = afterHide.indexOf("Press");
    const aboutAt = afterHide.indexOf("About");
    expect(pressAt).toBeGreaterThan(-1);
    expect(pressAt).toBeLessThan(aboutAt);

    await page.goto(`/sites/${siteId}/pages`);
    const rows = page.locator("table");
    await rows.getByRole("button", { name: "Menu for About" }).click();
    await page.getByRole("menuitem", { name: "Set as home" }).click();
    const aboutRow = rows
      .locator("[data-page-row]")
      .filter({ hasText: "About" });
    await expect(aboutRow.getByText("Home", { exact: true })).toBeVisible();
    await expect(aboutRow.locator("td").nth(2)).toHaveText("/");

    await rows.getByRole("button", { name: "Menu for Atlantic" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByRole("textbox", { name: "Title" }).fill("Shore");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Address" }).fill("shore");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Shore").first()).toBeVisible();

    await page.getByRole("link", { name: "Open editor" }).click();
    await page.locator("[data-page-picker]").click();
    await page.getByRole("menuitem", { name: "Work" }).click();
    await page.getByText("Atlantic, 2025").click();
    await expect(page.getByRole("textbox", { name: "Link" })).toHaveValue(
      linkBefore,
    );
    expect(await pickerLabels(page)).toContain("Shore");

    await page.goto(`/sites/${siteId}/pages`);
    await rows.getByRole("button", { name: "Menu for Press" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(
      page.getByRole("dialog", { name: "Delete Press?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Press")).toHaveCount(0);

    await rows.getByRole("button", { name: "Menu for Shore" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("link", { name: "Open editor" }).click();
    await page.locator("[data-page-picker]").click();
    await page.getByRole("menuitem", { name: "Work" }).click();
    await page.getByText("Atlantic, 2025").click();
    await expect(page.getByText("This page was deleted")).toBeVisible();
  });

  test("blank: create, rename and delete leave one page", async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    const siteId = await createFrom(
      page,
      "Start blank, An empty Home and Contact page",
      `Blank ${Math.random().toString(36).slice(2, 6)}`,
    );
    await page.goto(`/sites/${siteId}/pages`);
    const table = page.locator("table");
    await table.getByRole("button", { name: "Menu for Home" }).click();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeDisabled();
    await expect(
      page.getByText("Set another page as home first"),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "New page" }).click();
    await page.getByRole("textbox", { name: "Title" }).fill("Notes");
    await page.getByRole("button", { name: "Create page" }).click();
    await expect(page).toHaveURL(/editor/);
    await page.goto(`/sites/${siteId}/pages`);
    await table.getByRole("button", { name: "Menu for Notes" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByRole("textbox", { name: "Title" }).fill("Field notes");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Field notes").first()).toBeVisible();
    await table.getByRole("button", { name: "Menu for Field notes" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Field notes")).toHaveCount(0);
    await expect(page.getByText("Home").first()).toBeVisible();
    await expect(page.getByText("Contact").first()).toBeVisible();
  });

  test("keyboard reorder announces the new position", async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    const siteId = await createFrom(
      page,
      "Start blank, An empty Home and Contact page",
      `Keys ${Math.random().toString(36).slice(2, 6)}`,
    );
    await page.goto(`/sites/${siteId}/pages`);
    const live = page.locator("[data-pages-live]");
    await page
      .locator("table")
      .getByRole("button", { name: "Reorder Contact" })
      .focus();
    await page.keyboard.press("Space");
    await expect(live).toContainText("Contact lifted");
    await page.keyboard.press("ArrowUp");
    await expect(live).toContainText("position 1 of 2");
    await page.keyboard.press("Space");
    await expect(live).toContainText("Contact dropped");
    await page.getByRole("link", { name: "Open editor" }).click();
    const labels = await pickerLabels(page);
    expect(labels[0]).toBe("Contact");
  });
});
