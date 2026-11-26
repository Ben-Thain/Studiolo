import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MOCK = "http://127.0.0.1:54399";
const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);

function uniqueEmail() {
  return `editor.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
}
function authNext(next: string) {
  try {
    const url = new URL(next);
    return `${url.pathname}${url.search}`;
  } catch {
    return next;
  }
}

async function signInAs(page: Page, email: string, next = "/sites") {
  const dest = authNext(next);
  const tokenHash = `ok.${Buffer.from(email).toString("base64url")}`;
  await page.goto(
    `/auth/callback?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent(dest)}`,
  );
  await expect(page).toHaveURL(dest);
}

async function openOwnEditor(page: Page, email = uniqueEmail()) {
  await signInAs(page, email);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("textbox", { name: "Site name" })
    .fill(`Lab ${Math.random().toString(36).slice(2, 6)}`);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page).toHaveURL(/\/sites\/[0-9a-f-]{36}\/editor\/[0-9a-f-]{36}/);
  return email;
}

test.describe("desktop editor", () => {
  test("chrome is visible on first load without interaction", async ({
    page,
  }) => {
    await openOwnEditor(page);
    await expect(
      page.locator("[data-editor-add]").getByRole("button", { name: "Add" }),
    ).toBeVisible();
    await expect(page.getByText("Saved")).toBeVisible();
    await expect(
      page
        .locator("[data-editor-status]")
        .getByRole("link", { name: "Preview" }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Layers" }).getByRole("button").first(),
    ).toBeVisible();
  });

  test("images render on canvas", async ({ page }) => {
    await openOwnEditor(page);
    await page
      .locator("[data-editor-add]")
      .getByRole("button", { name: "Add" })
      .click();
    await page.getByRole("menuitem", { name: "Image" }).click();
    await page
      .locator("input[type=file]")
      .setInputFiles(path.join(FIXTURES, "sample.jpg"));
    const img = page.locator('[data-preview="desktop"] img').last();
    await expect(img).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(1);
  });

  test("switch page, mobile layout, and back", async ({ page }) => {
    await openOwnEditor(page);
    await page.getByRole("button", { name: "Home" }).click();
    await page.getByRole("menuitem", { name: "Contact" }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/);
    await expect(page.getByText("Send")).toBeVisible();
    await page.getByRole("radio", { name: "Mobile" }).click();
    await expect(page.locator('[data-preview="mobile"]')).toBeVisible();
    await expect(page).toHaveURL(/layout=mobile/);
    await page.getByRole("radio", { name: "Desktop" }).click();
    await expect(page.locator('[data-preview="desktop"]')).toBeVisible();
    await expect(page.getByText("Send")).toBeVisible();
  });

  test("add text box saves after debounce", async ({ page }) => {
    await openOwnEditor(page);
    await page
      .locator("[data-editor-add]")
      .getByRole("button", { name: "Add" })
      .click();
    await page.getByRole("menuitem", { name: "Text box" }).click();
    const field = page.locator("textarea").last();
    await field.fill("Persist me");
    await field.blur();
    await expect(page.getByText("Saving…")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByText("Persist me")).toBeVisible();
  });

  test("drag shows guides and resize changes layout", async ({ page }) => {
    await openOwnEditor(page);
    const item = page.locator("[data-element='Heading']");
    const before = Number(await item.getAttribute("data-col"));
    const spanBefore = Number(await item.getAttribute("data-span"));
    const box = await item.boundingBox();
    if (!box) throw new Error("no heading box");
    await page.mouse.move(box.x + 8, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 8, { steps: 10 });
    await expect(page.locator("[data-drag-guides]")).toBeVisible();
    await page.mouse.up();
    await expect
      .poll(async () => Number(await item.getAttribute("data-col")))
      .not.toBe(before);
    const handle = item.locator("[data-resize-handle]").first();
    const hb = await handle.boundingBox();
    expect(hb).toBeTruthy();
    await page.mouse.move(hb!.x + hb!.width / 2, hb!.y + hb!.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb!.x - 140, hb!.y + 48, { steps: 8 });
    await page.mouse.up();
    const spanAfter = Number(await item.getAttribute("data-span"));
    const rowsAfter = Number(await item.getAttribute("data-rows"));
    expect(spanAfter !== spanBefore || rowsAfter > 0).toBe(true);
    expect(spanAfter).not.toBe(spanBefore);
  });

  test("session expiry shows re-auth and saves after sign-in", async ({
    page,
    context,
  }) => {
    const email = await openOwnEditor(page);
    const back = page.url();
    await page.locator("[data-element='Heading']").click();
    await page.keyboard.press("ArrowRight");
    await context.clearCookies();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("dialog", { name: /Sign in to keep editing/ }),
    ).toBeVisible({ timeout: 15_000 });
    await signInAs(page, email, back);
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 20_000 });
  });

  test("crash recovery keeps nudge before debounce", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const email = await openOwnEditor(page);
    const item = page.locator("[data-element='Heading']");
    await item.click();
    const before = await item.getAttribute("data-col");
    const started = Date.now();
    await page.keyboard.press("ArrowRight");
    const url = page.url();
    await page.close();
    expect(Date.now() - started).toBeLessThan(200);
    const again = await context.newPage();
    await signInAs(again, email, url);
    await expect(again.locator("[data-element='Heading']")).toHaveAttribute(
      "data-col",
      String(Number(before) + 1),
    );
    await expect(again.getByText("Saved")).toBeVisible({ timeout: 20_000 });
    await context.close();
  });

  test("drag frame times stay under budget at 4x CPU", async ({ page }) => {
    await openOwnEditor(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.evaluate(() => {
      (window as unknown as { __dragWork: number[] }).__dragWork = [];
    });
    const item = page.locator("[data-element='Heading']");
    const box = await item.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + 8, box!.y + 8);
    await page.mouse.down();
    await page.mouse.move(box!.x + 220, box!.y + 12, { steps: 40 });
    await expect(page.locator("[data-drag-overlay]")).toBeVisible();
    await page.mouse.up();
    const samples = await page.evaluate(
      () => (window as unknown as { __dragWork: number[] }).__dragWork,
    );
    expect(samples.length).toBeGreaterThan(4);
    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 999;
    console.log("drag p95 frame ms:", p95);
    expect(p95).toBeLessThanOrEqual(16.7);
  });

  test("two text adds are separate undo steps after a layout switch", async ({
    page,
  }) => {
    await openOwnEditor(page);
    for (let i = 0; i < 2; i += 1) {
      await page
        .locator("[data-editor-add]")
        .getByRole("button", { name: "Add" })
        .click();
      await page.getByRole("menuitem", { name: "Text box" }).click();
    }
    await expect(page.locator("[data-element='Text']")).toHaveCount(2);
    await page.getByRole("radio", { name: "Mobile" }).click();
    await page.getByRole("radio", { name: "Desktop" }).click();
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+z");
    await expect(page.locator("[data-element='Text']")).toHaveCount(0);
  });

  test("layers plus opens the add menu and F2 renames inline", async ({
    page,
  }) => {
    await openOwnEditor(page);
    await page.locator("button[aria-label='Add']").click();
    await expect(
      page.getByRole("menuitem", { name: "Text box" }),
    ).toBeVisible();
    await expect(page.locator("[data-element='Text']")).toHaveCount(0);
    const menu = page.getByRole("menu");
    const width = await menu.evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(width)).toBe(248);
    const kbd = menu.locator("kbd").first();
    const border = await kbd.evaluate(
      (el) => getComputedStyle(el).borderTopWidth,
    );
    expect(border).not.toBe("0px");
    await page.keyboard.press("Escape");
    await page.locator("[data-element='Heading']").click();
    await page.keyboard.press("F2");
    const input = page.getByRole("textbox", { name: "Rename Heading" });
    await expect(input).toBeVisible();
    await input.fill("Title");
    await input.press("Enter");
    await expect(page.locator("[data-element='Title']")).toBeVisible();
  });

  test("uploads a jpg and a heic, then replace and delete undo", async ({
    page,
  }) => {
    await openOwnEditor(page);
    const siteId = page.url().match(/sites\/([0-9a-f-]{36})/)![1];
    await page
      .locator("[data-editor-add]")
      .getByRole("button", { name: "Add" })
      .click();
    await page.getByRole("menuitem", { name: "Image" }).click();
    await page
      .locator("input[type=file]")
      .setInputFiles(path.join(FIXTURES, "sample.jpg"));
    await expect(
      page.locator("[data-preview='desktop'] img").last(),
    ).toBeVisible({
      timeout: 20_000,
    });
    const jpg = await (
      await page.request.get(`${MOCK}/__assets?site=${siteId}`)
    ).json();
    expect(jpg.some((row: { bytes: number }) => row.bytes > 0)).toBe(true);
    await expect
      .poll(async () =>
        page
          .locator("[data-preview='desktop'] img")
          .last()
          .evaluate((el: HTMLImageElement) => el.naturalWidth),
      )
      .toBeGreaterThan(1);

    await page
      .locator("[data-editor-add]")
      .getByRole("button", { name: "Add" })
      .click();
    await page.getByRole("menuitem", { name: "Image" }).click();
    await page
      .locator("input[type=file]")
      .setInputFiles(path.join(FIXTURES, "sample.heic"));
    await expect
      .poll(async () => {
        const rows = await (
          await page.request.get(`${MOCK}/__assets?site=${siteId}`)
        ).json();
        return rows.filter((row: { bytes: number }) => row.bytes > 0).length;
      })
      .toBeGreaterThan(1);

    await page.getByRole("button", { name: "Replace image" }).click();
    await page
      .locator("input[type=file]")
      .setInputFiles(path.join(FIXTURES, "sample.jpg"));
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole("button", { name: "Delete from both layouts" })
      .click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.keyboard.press("Control+z");
    await expect(
      page.locator("[data-preview='desktop'] img").last(),
    ).toBeVisible();
  });

  test("picking Geist requests the face and applies it", async ({ page }) => {
    await openOwnEditor(page);
    await page.locator("[data-element='Heading']").click();
    const request = page.waitForRequest((req) =>
      req.url().includes("/fonts/Geist.css"),
    );
    await page.getByLabel("Font").selectOption("Geist");
    await request;
    await expect
      .poll(async () =>
        page
          .locator("[data-element='Heading'] p")
          .evaluate((el) => getComputedStyle(el).fontFamily),
      )
      .toContain("Geist");
  });
});
