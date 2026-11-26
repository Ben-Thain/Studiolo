import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resizeFromCorner, type ResizeCorner } from "../../src/editor/resize";

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
    const axis = await page
      .locator("[data-guide-axis]")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).dataset.guideAxis),
      );
    expect(axis.length).toBeGreaterThan(0);
    expect(axis.length).toBeLessThanOrEqual(4);
    const yLine = page.locator("[data-guide-axis='y']");
    if ((await yLine.count()) > 0) {
      const yBox = await yLine.first().boundingBox();
      const xBox = await page
        .locator("[data-guide-axis='x']")
        .first()
        .boundingBox();
      expect(yBox!.height).toBeLessThan(xBox!.height);
    }
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

  test("y guides stay inside the dragged section", async ({ page }) => {
    await openOwnEditor(page);
    const section = page.locator("[data-section]").nth(1);
    const item = section.locator("[data-element]").first();
    const box = await item.boundingBox();
    if (!box) throw new Error("no element in the second section");
    await page.mouse.move(box.x + 16, box.y + 16);
    await page.mouse.down();
    await page.mouse.move(box.x + 140, box.y + 16, { steps: 8 });
    const lines = page.locator("[data-guide-axis='y']");
    await expect(lines.first()).toBeVisible();
    const sectionBox = await section.boundingBox();
    if (!sectionBox) throw new Error("no section box");
    const count = await lines.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const line = await lines.nth(i).boundingBox();
      expect(line).toBeTruthy();
      expect(line!.y).toBeGreaterThanOrEqual(sectionBox.y - 1);
      expect(line!.y + line!.height).toBeLessThanOrEqual(
        sectionBox.y + sectionBox.height + 1,
      );
    }
    await page.mouse.up();
  });

  test("each corner resizes from the opposite corner", async ({ page }) => {
    await openOwnEditor(page);
    const item = page.locator("[data-element='Hero image']");
    await item.click();
    const colWidth = (1440 - 64 - 11 * 24) / 12;
    const drag = async (corner: ResizeCorner, dx: number, dy: number) => {
      const handle = item.locator(`[data-corner='${corner}']`);
      const hit = await handle.boundingBox();
      expect(hit).toBeTruthy();
      expect(hit!.width).toBeGreaterThanOrEqual(24);
      expect(hit!.height).toBeGreaterThanOrEqual(24);
      const start = {
        col: Number(await item.getAttribute("data-col")),
        span: Number(await item.getAttribute("data-span")),
        row: Number(await item.getAttribute("data-row")),
        rows: Number(await item.getAttribute("data-rows")),
      };
      const scale = Number(
        await page
          .locator("[data-editor-canvas]")
          .getAttribute("data-stage-scale"),
      );
      const dCol = Math.round(dx / scale / colWidth);
      const dRow = Math.round(dy / scale / 8);
      const expected = resizeFromCorner(start, dCol, dRow, corner);
      const cx = hit!.x + hit!.width / 2;
      const cy = hit!.y + hit!.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
      await page.mouse.up();
      await expect
        .poll(async () => item.getAttribute("data-col"))
        .toBe(String(expected.col));
      await expect
        .poll(async () => item.getAttribute("data-span"))
        .toBe(String(expected.span));
      await expect
        .poll(async () => item.getAttribute("data-row"))
        .toBe(String(expected.row));
      await expect
        .poll(async () => item.getAttribute("data-rows"))
        .toBe(String(expected.rows));
      return start;
    };
    const before = await drag("se", -220, 48);
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => item.getAttribute("data-span"))
      .toBe(String(before.span));
    await expect
      .poll(async () => item.getAttribute("data-col"))
      .toBe(String(before.col));
    await drag("nw", -180, 64);
    await drag("ne", 40, 64);
    await drag("sw", -180, 40);
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
      const target = window as unknown as { __frameDeltas: number[] };
      target.__frameDeltas = [];
      let last = performance.now();
      let prev = "";
      const tick = (now: number) => {
        const overlay = document.querySelector(
          "[data-drag-overlay]",
        ) as HTMLElement | null;
        const transform = overlay?.style.transform ?? "";
        if (transform && prev && transform !== prev) {
          target.__frameDeltas.push(now - last);
        }
        if (transform) prev = transform;
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const item = page.locator("[data-element='Heading']");
    const box = await item.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + 8, box!.y + 8);
    await page.mouse.down();
    await page.mouse.move(box!.x + 280, box!.y + 36, { steps: 50 });
    await expect(page.locator("[data-drag-overlay]")).toBeVisible();
    await page.mouse.up();
    const samples = await page.evaluate(
      () => (window as unknown as { __frameDeltas: number[] }).__frameDeltas,
    );
    expect(samples.length).toBeGreaterThan(4);
    const sorted = [...samples].sort((a, b) => a - b);
    const p95 =
      sorted[
        Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
      ] ?? 999;
    const slow =
      samples.filter((sample) => sample > 25).length / samples.length;
    console.log("drag rAF p95 ms:", p95, "slow fraction:", slow);
    expect(p95).toBeLessThanOrEqual(17);
    expect(slow).toBeLessThan(0.05);
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
    const headingRow = page.getByRole("button", { name: "Heading" });
    await expect(headingRow.locator("[data-icon='text']")).toBeVisible();
    const textIcon = await headingRow.locator("svg").first().boundingBox();
    expect(textIcon!.width).toBeGreaterThanOrEqual(15);
    expect(textIcon!.height).toBeGreaterThanOrEqual(15);
    await expect(
      page
        .getByRole("button", { name: "Hero image" })
        .locator("[data-icon='image']"),
    ).toBeVisible();
    const sectionIcon = page.locator("[data-icon='chevron-down']").first();
    const sectionBox = await sectionIcon.boundingBox();
    expect(textIcon!.x).toBeGreaterThan(sectionBox!.x);
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
      .setInputFiles(path.join(FIXTURES, "wide.jpg"));
    await expect(
      page.locator("[data-preview='desktop'] img").last(),
    ).toBeVisible({
      timeout: 20_000,
    });
    const jpg = await (
      await page.request.get(`${MOCK}/__assets?site=${siteId}`)
    ).json();
    const uploaded = jpg.find((row: { bytes: number }) => row.bytes > 0) as {
      width: number;
    };
    expect(uploaded.width).toBe(80);
    await expect
      .poll(async () =>
        page
          .locator("[data-preview='desktop'] img")
          .last()
          .evaluate((el: HTMLImageElement) => el.naturalWidth),
      )
      .toBe(uploaded.width);

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

  test("picking each family loads a real woff2", async ({ page }) => {
    await openOwnEditor(page);
    await page.locator("[data-element='Heading']").click();
    const files = [
      "geist-latin-400-normal.woff2",
      "manrope-latin-400-normal.woff2",
      "instrument-serif-latin-400-normal.woff2",
    ];
    const responses = Promise.all(
      files.map((file) =>
        page.waitForResponse(
          (response) =>
            response.url().includes(file) && response.status() === 200,
        ),
      ),
    );
    const stylesheets = Promise.all(
      ["Geist.css", "Manrope.css", "Instrument-Serif.css"].map((file) =>
        page.waitForResponse(
          (response) =>
            response.url().includes(`/fonts/${file}`) &&
            response.status() === 200,
        ),
      ),
    );
    await page.getByLabel("Font").focus();
    await stylesheets;
    await page.evaluate(async () => {
      await Promise.all(
        ["Geist", "Manrope", "Instrument Serif"].map((name) =>
          document.fonts.load(`40px "${name}"`),
        ),
      );
    });
    await responses;
    for (const family of ["Geist", "Manrope", "Instrument Serif"] as const) {
      await page.getByLabel("Font").selectOption(family);
      await page.evaluate(async (name) => {
        await document.fonts.load(`40px "${name}"`);
        const face = [...document.fonts].find((item) => item.family === name);
        if (!face || face.status !== "loaded") {
          throw new Error(`${name} status ${face?.status ?? "missing"}`);
        }
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas");
        const sample = "Hamburgefonstiv";
        ctx.font = `40px "${name}"`;
        const width = ctx.measureText(sample).width;
        const fallback = name === "Instrument Serif" ? "serif" : "sans-serif";
        ctx.font = `40px ${fallback}`;
        const other = ctx.measureText(sample).width;
        if (Math.abs(width - other) < 0.5) {
          throw new Error(
            `${name} width ${width} matches ${fallback} ${other}`,
          );
        }
      }, family);
      await expect
        .poll(async () =>
          page
            .locator("[data-element='Heading'] p")
            .evaluate((el) => getComputedStyle(el).fontFamily),
        )
        .toContain(family);
    }
  });
});
