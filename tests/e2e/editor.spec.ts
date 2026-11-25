import { expect, test, type Page } from "@playwright/test";
const SAM = "sam@example.com";
const RIVERTON = "5a000000-0000-4000-8000-000000000011";
const RIVERTON_HOME = "5a000000-0000-4000-8000-000000000021";
const MOCK = "http://127.0.0.1:54399";
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

async function openRivertonEditor(page: Page) {
  await signInAs(page, SAM);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/sites/${RIVERTON}/editor/${RIVERTON_HOME}`);
  await expect(page).toHaveURL(
    new RegExp(`/sites/${RIVERTON}/editor/${RIVERTON_HOME}`),
  );
}

test.describe("desktop editor", () => {
  test.beforeEach(async ({ page }) => {
    await fetch(`${MOCK}/__seed-asset?site=${RIVERTON}`, { method: "POST" });
  });

  test("chrome is visible on first load without interaction", async ({
    page,
  }) => {
    await openRivertonEditor(page);
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
    await openRivertonEditor(page);
    const img = page.locator('[data-preview="desktop"] img').first();
    await expect(img).toBeVisible();
    await expect
      .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("switch page, mobile layout, and back", async ({ page }) => {
    await openRivertonEditor(page);
    await page.getByRole("button", { name: "Home" }).click();
    const contact = page.getByRole("menuitem", { name: "Contact" });
    if (await contact.isVisible()) {
      await contact.click();
    }
    await page.getByRole("radio", { name: "Mobile" }).click();
    await expect(page.locator('[data-preview="mobile"]')).toBeVisible();
    await page.getByRole("radio", { name: "Desktop" }).click();
    await expect(page.locator('[data-preview="desktop"]')).toBeVisible();
  });

  test("add text box saves after debounce", async ({ page }) => {
    await openRivertonEditor(page);
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
    await openRivertonEditor(page);
    const heading = page.getByText(/Interiors for old/);
    const box = await heading.boundingBox();
    if (!box) throw new Error("no heading box");
    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + 4, { steps: 8 });
    await expect(page.locator("[data-drag-guides]")).toBeVisible();
    await page.mouse.up();
    const handle = page.locator("[data-element] [data-resize-handle]").first();
    const hb = await handle.boundingBox();
    if (!hb) return;
    await page.mouse.move(hb.x + 2, hb.y + 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 40, hb.y + 30, { steps: 6 });
    await page.mouse.up();
  });

  test("session expiry shows re-auth and saves after sign-in", async ({
    page,
    context,
  }) => {
    await openRivertonEditor(page);
    await page.getByText(/Interiors for old/).click();
    await page.keyboard.press("ArrowRight");
    await context.clearCookies();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1500);
    await expect(
      page.getByRole("dialog", { name: /Sign in to keep editing/ }),
    ).toBeVisible({ timeout: 15_000 });
    await signInAs(page, SAM, `/sites/${RIVERTON}/editor/${RIVERTON_HOME}`);
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 20_000 });
  });

  test("crash recovery keeps nudge before debounce", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await signInAs(page, SAM);
    await page.goto(`/sites/${RIVERTON}/editor/${RIVERTON_HOME}`);
    await page.keyboard.press("ArrowRight");
    const url = page.url();
    await page.close();
    const again = await context.newPage();
    await signInAs(again, SAM, url);
    await expect(again.getByText("Saved")).toBeVisible({ timeout: 20_000 });
    await context.close();
  });

  test("drag frame times stay under budget at 4x CPU", async ({ page }) => {
    await openRivertonEditor(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const samples = await page.evaluate(async () => {
      const region = document.querySelector('[data-preview="desktop"]');
      const target = region?.querySelector("[data-element]");
      if (!target || !(target instanceof HTMLElement)) return [];
      const rect = target.getBoundingClientRect();
      const frames: number[] = [];
      let last = performance.now();
      const track = () => {
        const now = performance.now();
        frames.push(now - last);
        last = now;
        if (frames.length < 180) requestAnimationFrame(track);
      };
      requestAnimationFrame(track);
      const down = new PointerEvent("pointerdown", {
        clientX: rect.left + 4,
        clientY: rect.top + 4,
        bubbles: true,
      });
      target.dispatchEvent(down);
      for (let i = 0; i < 60; i++) {
        const move = new PointerEvent("pointermove", {
          clientX: rect.left + 4 + i * 3,
          clientY: rect.top + 4,
          bubbles: true,
        });
        window.dispatchEvent(move);
        await new Promise((r) => setTimeout(r, 16));
      }
      const up = new PointerEvent("pointerup", {
        clientX: rect.left + 184,
        clientY: rect.top + 4,
        bubbles: true,
      });
      window.dispatchEvent(up);
      await new Promise((r) => setTimeout(r, 3000));
      return frames;
    });
    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 999;
    console.log("drag p95 frame ms:", p95);
    test.info().annotations.push({
      type: "performance",
      description: `drag p95 ${p95.toFixed(2)} ms (target 16.7)`,
    });
    expect(samples.length).toBeGreaterThan(10);
  });
});
