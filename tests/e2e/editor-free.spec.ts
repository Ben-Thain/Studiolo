import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);
const SHOTS = "/opt/cursor/artifacts/06c";

function uniqueEmail() {
  return `free.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
}

async function frames() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function signIn(page: Page) {
  const email = uniqueEmail();
  const tokenHash = `ok.${Buffer.from(email).toString("base64url")}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `/auth/callback?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent("/sites")}`,
  );
  await expect(page).toHaveURL("/sites");
}

async function createStill(page: Page) {
  await signIn(page);
  await page.getByRole("radio", { name: "Still, Photographer" }).click();
  await page
    .getByRole("textbox", { name: "Site name" })
    .fill(`Free Canvas ${Math.random().toString(36).slice(2, 6)}`);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page).toHaveURL(
    /\/sites\/[0-9a-f-]{36}\/editor\/[0-9a-f-]{36}/,
    {
      timeout: 60_000,
    },
  );
  await expect(
    page.getByText("Photographs of the Atlantic coast"),
  ).toBeVisible();
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible()) await gotIt.click();
}

function elementByName(page: Page, name: string) {
  return page.locator(`[data-element="${name}"]`);
}

async function scaleOf(page: Page) {
  return Number(
    await page.locator("[data-editor-canvas]").getAttribute("data-stage-scale"),
  );
}

async function centreOf(target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error("missing box");
  return { box, x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe.configure({ mode: "serial" });

test.describe("free canvas", () => {
  test("drag follows the pointer, then a second drag starts immediately", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await createStill(page);
    const heading = elementByName(page, "Statement");
    await heading.click();
    const before = await heading.boundingBox();
    if (!before) throw new Error("heading box");
    const startX = before.x + 40;
    const startY = before.y + 16;
    await page.keyboard.down("Alt");
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 20; i += 1) {
      await page.mouse.move(startX + i * 6, startY + i * 3);
      await page.evaluate(frames);
      const now = await heading.boundingBox();
      if (!now) throw new Error("lost");
      const drift = Math.hypot(
        now.x - before.x - i * 6,
        now.y - before.y - i * 3,
      );
      expect(drift).toBeLessThanOrEqual(1.5);
    }
    const drawn = await heading.boundingBox();
    await page.mouse.up();
    await page.keyboard.up("Alt");
    if (!drawn) throw new Error("landing box");
    await expect
      .poll(async () => {
        const landed = await heading.boundingBox();
        if (!landed) return 999;
        return (
          Math.hypot(landed.x - drawn.x, landed.y - drawn.y) /
          (await scaleOf(page))
        );
      })
      .toBeLessThanOrEqual((1440 - 64) / 96 / 2 + 1);

    const col = await heading.getAttribute("data-col");
    const again = await centreOf(heading);
    await page.keyboard.down("Alt");
    await page.mouse.move(again.x, again.y);
    await page.mouse.down();
    await page.mouse.move(again.x + 90, again.y + 10, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    await expect(heading).not.toHaveAttribute("data-col", col ?? "");
  });

  test("a real photo stays 320px tall and a 60px drag lands on the row", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await createStill(page);
    const image = page
      .locator("[data-element]")
      .filter({ has: page.locator("img") })
      .first();
    await image.click();
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(FIXTURES, "photo-1600.jpg"));
    await image.click();
    const height = page.getByRole("textbox", { name: "H" });
    await height.fill("320");
    await height.blur();
    await expect
      .poll(async () => {
        const box = await image.boundingBox();
        return box ? Math.round(box.height / (await scaleOf(page))) : 0;
      })
      .toBe(320);

    const text = elementByName(page, "About line");
    await text.scrollIntoViewIfNeeded();
    const start = await text.boundingBox();
    if (!start) throw new Error("about line");
    const scale = await scaleOf(page);
    await text.click();
    await page.keyboard.down("Alt");
    await page.mouse.move(start.x + 20, start.y + 12);
    await page.mouse.down();
    await page.mouse.move(start.x + 20, start.y + 12 + 60 * scale, {
      steps: 6,
    });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    const after = await text.boundingBox();
    if (!after) throw new Error("about line after");
    expect(Math.abs((after.y - start.y) / scale - 60)).toBeLessThanOrEqual(4.1);
  });

  test("drops into the section under the pointer and undo puts it back", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await createStill(page);
    const intro = page.locator('[data-section="Intro"]').first();
    const work = page.locator('[data-section="Work"]');
    const moving = elementByName(page, "Statement");
    const from = await moving.boundingBox();
    if (!from) throw new Error("statement");
    await page.mouse.move(from.x + 40, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 320, { steps: 20 });
    await page.evaluate(frames);
    await page.screenshot({ path: `${SHOTS}/03-cross-section.png` });
    const label = await page
      .locator("[data-drop-target='true']")
      .getAttribute("data-section");
    await page.mouse.up();
    await expect(work.locator('[data-element="Statement"]')).toHaveCount(1);
    expect(label).toBe("Work");
    await page.keyboard.press("Control+z");
    await expect(intro.locator('[data-element="Statement"]')).toHaveCount(1);
  });

  test("alt hides guides, resize shows a size, overlap persists, arrows nudge", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await createStill(page);
    const statement = elementByName(page, "Statement");
    const box = await statement.boundingBox();
    if (!box) throw new Error("statement");
    await statement.click();
    const sectionBox = await page
      .locator('[data-section="Intro"]')
      .first()
      .boundingBox();
    if (!sectionBox) throw new Error("intro");
    const pointerX = sectionBox.x + sectionBox.width / 2 - box.width / 2 + 36;
    const pointerY = sectionBox.y + sectionBox.height / 2 - box.height / 2 + 16;
    await page.mouse.move(box.x + 36, box.y + 16);
    await page.mouse.down();
    await page.mouse.move(pointerX, pointerY, { steps: 12 });
    await page.evaluate(frames);
    await expect
      .poll(async () => page.locator("[data-guide-label='Centre']").count())
      .toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS}/02-centre-guide.png` });
    await page.keyboard.down("Alt");
    await page.mouse.move(box.x + 70, box.y + 40);
    await page.evaluate(frames);
    await expect(page.locator("[data-drag-guides]")).toBeHidden();
    await page.keyboard.up("Alt");
    await page.mouse.up();

    const image = page
      .locator("[data-element]")
      .filter({ has: page.locator("img") })
      .first();
    await image.evaluate((el) => {
      let scroller: HTMLElement | null = el.parentElement;
      while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) {
        scroller = scroller.parentElement;
      }
      if (!scroller) return;
      const top =
        el.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      scroller.scrollTop = Math.max(0, top - 180);
    });
    const imageBox = await image.boundingBox();
    if (!imageBox || imageBox.y < 40 || imageBox.y > 640) {
      throw new Error(`image at ${imageBox?.y}`);
    }
    await image.click();
    await page.getByRole("button", { name: "Bring to front" }).click();
    for (const handle of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
      const knob = image.locator(`[data-handle="${handle}"]`);
      const knobBox = await knob.boundingBox();
      if (!knobBox) throw new Error(handle);
      const hx = knobBox.x + knobBox.width / 2;
      const hy = knobBox.y + knobBox.height / 2;
      await page.mouse.move(hx, hy);
      await page.mouse.down();
      await page.mouse.move(
        knobBox.x + knobBox.width / 2 + 20,
        knobBox.y + knobBox.height / 2 + 12,
      );
      await page.evaluate(frames);
      await expect(page.locator("[data-drag-readout]")).toContainText("×");
      if (handle === "se") {
        await page.screenshot({ path: `${SHOTS}/04-resize.png` });
      }
      await page.mouse.up();
    }
    await expect(page.getByText("Image resized").last()).toBeVisible();

    const caption = elementByName(page, "Caption: Atlantic");
    await caption.scrollIntoViewIfNeeded();
    const captionAt = await centreOf(caption);
    const photoAt = await centreOf(image);
    await page.keyboard.down("Alt");
    await page.mouse.move(captionAt.x, captionAt.y);
    await page.mouse.down();
    await page.mouse.move(photoAt.x, photoAt.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    await page.getByRole("button", { name: "Bring to front" }).click();
    await page.screenshot({ path: `${SHOTS}/05-overlap.png` });
    const zBefore = await caption.evaluate(
      (node) => getComputedStyle(node).zIndex,
    );
    await page.reload();
    await expect(caption).toBeVisible();
    await caption.click();
    expect(
      await caption.evaluate((node) => getComputedStyle(node).zIndex),
    ).toBe(zBefore);

    await statement.click();
    const startCol = Number(await statement.getAttribute("data-col"));
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => Number(await statement.getAttribute("data-col")))
      .toBe(startCol + 1);
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.up("Shift");
    await expect
      .poll(async () => Number(await statement.getAttribute("data-col")))
      .toBe(startCol + 9);
  });
});
