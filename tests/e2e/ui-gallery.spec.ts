import { expect, test } from "@playwright/test";

test("gallery matches the shell anatomy", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/ui");

  const sidebar = page.locator("div.w-\\[240px\\]").first();
  await expect(sidebar).toHaveCSS("width", "240px");

  const sites = page
    .getByRole("button", { name: "Sites", exact: true })
    .first();
  await expect(sites).toHaveCSS("height", "40px");

  const topBar = page
    .locator("header")
    .filter({ hasText: "Riverton House" })
    .first();
  await expect(topBar).toHaveCSS("height", "56px");

  const primary = page.getByRole("button", { name: "New site" }).first();
  await expect(primary).toHaveCSS("height", "32px");
  await expect(primary).toHaveCSS("box-shadow", "none");
  await expect(sites).toHaveCSS("box-shadow", "none");

  const dialogFrame = page
    .getByRole("heading", { name: "Delete site" })
    .locator("xpath=ancestor::div[contains(@class,'w-[440px]')]")
    .first();
  await expect(dialogFrame).toHaveCSS("width", "440px");
  await expect(dialogFrame).toHaveCSS("border-radius", "12px");

  const popoverFrame = page.getByText("Publish Riverton House").first();
  const popoverBox = popoverFrame.locator(
    "xpath=ancestor::div[contains(@class,'w-[380px]')]",
  );
  await expect(popoverBox).toHaveCSS("width", "380px");
  await expect(popoverBox).toHaveCSS("border-radius", "8px");

  await page.getByRole("button", { name: "Open delete dialog" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete site" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("width", "440px");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Open delete dialog" }),
  ).toBeFocused();

  const menuButton = page.getByRole("button", { name: "Open menu" });
  await menuButton.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(menuButton).toBeFocused();

  const publish = page
    .getByRole("button", { name: "Publish", exact: true })
    .first();
  await publish.click();
  const publishDialog = page.getByRole("dialog", {
    name: "Publish Riverton House",
  });
  await expect(publishDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(publishDialog).toBeHidden();
  await expect(publish).toBeFocused();

  await page.getByRole("button", { name: "Open publish sheet" }).click();
  const sheet = page.getByRole("dialog", { name: "Publish Riverton House" });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  const touch = page.getByRole("button", { name: "Touch" });
  await expect(touch).toHaveCSS("height", "48px");
  const icon = page.getByRole("button", { name: "More options" });
  const iconBox = await icon.boundingBox();
  expect(iconBox?.width).toBeGreaterThanOrEqual(44);
  expect(iconBox?.height).toBeGreaterThanOrEqual(44);

  const toast = page
    .getByRole("status")
    .filter({ hasText: "Duplicated North Light" });
  await expect(toast).toHaveCSS("height", "48px");

  const families = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].map(
      (font) => `${font.family} ${font.weight} ${font.status}`,
    );
  });
  const inter = families.filter((font) => font.startsWith("Inter "));
  expect(
    inter.some((font) => font.includes("400") && font.includes("loaded")),
  ).toBe(true);
  expect(
    inter.some((font) => font.includes("500") && font.includes("loaded")),
  ).toBe(true);
  expect(inter.some((font) => /\b600\b/.test(font))).toBe(false);

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toHaveCSS("outline-style", "solid");
  await expect(focused).toHaveCSS("outline-width", "2px");
  await expect(focused).toHaveCSS("outline-offset", "2px");
});

test("mobile gallery targets are at least 44px", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/dev/ui");
  const back = page
    .locator("header")
    .filter({ hasText: "Home" })
    .getByRole("button", { name: "Sites" });
  const box = await back.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);

  const tab = page.getByRole("button", { name: "Account", exact: true }).last();
  const tabBox = await tab.boundingBox();
  expect(tabBox?.height).toBeGreaterThanOrEqual(44);
});
