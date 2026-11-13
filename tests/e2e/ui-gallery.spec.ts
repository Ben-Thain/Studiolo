import { expect, test, type Page } from "@playwright/test";

const allowedColours = new Set([
  "rgb(255, 255, 255)",
  "rgb(250, 250, 250)",
  "rgb(245, 245, 245)",
  "rgb(10, 10, 10)",
  "rgb(82, 82, 82)",
  "rgb(115, 115, 115)",
  "rgb(163, 163, 163)",
  "rgb(229, 229, 229)",
  "rgb(180, 35, 24)",
  "rgb(38, 38, 38)",
  "rgb(145, 32, 24)",
  "rgba(0, 0, 0, 0)",
  "rgba(10, 10, 10, 0.24)",
  "rgba(10, 10, 10, 0.4)",
  "rgba(255, 255, 255, 0.6)",
]);

function normalise(color: string) {
  return color.replace(/\s+/g, " ").replace(/0.40/g, "0.4").trim();
}

async function ringOf(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) return null;
    if (!active.closest("#app-root, [role='menu'], [role='dialog'], [data-toast]")) {
      return { text: "", solid: true, colour: "", onInk: false, skip: true };
    }
    const own = getComputedStyle(active);
    const parent = active.parentElement ? getComputedStyle(active.parentElement) : null;
    const style = own.outlineStyle === "solid" ? own : parent?.outlineStyle === "solid" ? parent : null;
    return {
      text: (active.textContent ?? "").trim().slice(0, 40),
      solid: style?.outlineStyle === "solid",
      colour: style?.outlineColor ?? "",
      onInk: Boolean(active.closest(".on-ink")),
      skip: false,
    };
  });
}

test("gallery matches the real panels at 1440", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/ui");

  const sidebar = page.locator("div.w-\\[240px\\]").first();
  await expect(sidebar).toHaveCSS("width", "240px");

  const sites = page.getByRole("link", { name: "Sites", exact: true }).first();
  await expect(sites).toHaveCSS("height", "40px");

  const topBar = page.locator("header").filter({ hasText: "Riverton House" }).first();
  await expect(topBar).toHaveCSS("height", "56px");
  const live = topBar.getByText("Live", { exact: true });
  await expect(live).toHaveCSS("font-size", "12px");
  await expect(live).toHaveCSS("color", "rgb(115, 115, 115)");

  const primary = page.getByRole("button", { name: "New site" }).first();
  await expect(primary).toHaveCSS("height", "32px");
  await expect(primary).toHaveCSS("box-shadow", "none");

  const popover = page.locator("[data-inline='popover']");
  await expect(popover).toHaveCSS("width", "360px");
  await expect(popover).toHaveCSS("border-radius", "8px");
  const popoverShadow = await popover.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(popoverShadow).toContain("rgba(10, 10, 10, 0.08)");

  const dialog = page.locator("[data-inline='dialog']");
  await expect(dialog).toHaveCSS("width", "440px");
  await expect(dialog).toHaveCSS("border-radius", "12px");
  await expect(dialog).toHaveCSS("padding", "24px");
  const dialogShadow = await dialog.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(dialogShadow).toContain("rgba(10, 10, 10, 0.16)");
  await expect(dialog.getByRole("heading", { name: "Delete Riverton House?" })).toBeVisible();

  const toast = page.getByText("Duplicated North Light. The copy is a draft.");
  await expect(toast).toBeVisible();
  const toastBox = await toast.boundingBox();
  const column = page.locator("[data-toast-region='duplicated']");
  const columnBox = await column.boundingBox();
  expect(toastBox && columnBox).toBeTruthy();
  if (toastBox && columnBox) {
    expect(toastBox.x).toBeGreaterThanOrEqual(columnBox.x - 1);
    expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(columnBox.x + columnBox.width + 1);
  }
  const toastCard = page.locator("[data-toast]").filter({ hasText: "Duplicated North Light" });
  await expect(toastCard).toHaveCSS("height", "48px");
  await expect(toastCard).toHaveCSS("font-size", "13px");

  const toastBoxes = await page.locator("[data-toast]").evaluateAll((elements) =>
    elements.map((element) => {
      const card = element.getBoundingClientRect();
      const frame = element.closest("[data-frame]")?.getBoundingClientRect();
      const text = element.querySelector("span");
      const line = text ? parseFloat(getComputedStyle(text).lineHeight) : 20;
      const lines = text ? Math.round(text.getBoundingClientRect().height / line) : 1;
      const mobile = Boolean(element.closest("[data-frame='mobile']"));
      return {
        x: card.x,
        y: card.y,
        width: card.width,
        height: card.height,
        right: card.right,
        bottom: card.bottom,
        lines,
        mobile,
        frame: frame
          ? { x: frame.x, y: frame.y, right: frame.right, bottom: frame.bottom }
          : null,
      };
    }),
  );
  expect(toastBoxes.length).toBeGreaterThanOrEqual(3);
  for (const box of toastBoxes) {
    expect(box.frame).toBeTruthy();
    if (!box.frame) continue;
    expect(box.x).toBeGreaterThanOrEqual(box.frame.x - 1);
    expect(box.right).toBeLessThanOrEqual(box.frame.right + 1);
    expect(box.y).toBeGreaterThanOrEqual(box.frame.y - 1);
    expect(box.bottom).toBeLessThanOrEqual(box.frame.bottom + 1);
    if (box.lines <= 1) {
      expect(box.height).toBe(box.mobile ? 52 : 48);
    }
  }
  for (let left = 0; left < toastBoxes.length; left += 1) {
    for (let right = left + 1; right < toastBoxes.length; right += 1) {
      const a = toastBoxes[left];
      const b = toastBoxes[right];
      const overlaps = a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
      expect(overlaps).toBe(false);
    }
  }
  await page.waitForTimeout(11000);
  await expect(page.getByText("Duplicated North Light. The copy is a draft.")).toBeVisible();
  await expect(page.getByText("North Light deleted").first()).toBeVisible();

  await page.getByRole("button", { name: "Open delete dialog" }).click();
  const liveDialog = page
    .locator("[aria-modal='true']")
    .filter({ hasText: "Delete Riverton House?" });
  await expect(liveDialog).toBeVisible();
  await expect(liveDialog).toHaveCSS("width", "440px");
  await page.keyboard.press("Escape");
  await expect(liveDialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Open delete dialog" })).toBeFocused();

  async function exerciseMenu(name: string) {
    const trigger = page.getByRole("button", { name });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(page.locator(":focus")).toHaveAttribute("role", "menuitem");
    const first = await page.locator(":focus").innerText();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(":focus")).toHaveAttribute("role", "menuitem");
    expect(await page.locator(":focus").innerText()).not.toBe(first);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("menu")).toHaveCount(0);
  }
  await exerciseMenu("Open menu");
  await exerciseMenu("Actions for North Light");

  const publish = page.getByRole("button", { name: "Publish", exact: true }).first();
  await publish.click();
  const publishDialog = page.locator("[role='dialog'][aria-label='Publish Riverton House']:not([data-inline])");
  await expect(publishDialog).toBeVisible();
  await expect(publishDialog).toHaveCSS("width", "360px");
  await page.keyboard.press("Escape");
  await expect(publishDialog).toBeHidden();
  await expect(publish).toBeFocused();

  const contained = await page.evaluate(() => {
    function insets(element: Element) {
      const box = element.getBoundingClientRect();
      return Array.from(element.children).map((child) => {
        const childBox = child.getBoundingClientRect();
        return {
          top: childBox.top - box.top,
          left: childBox.left - box.left,
          bottom: box.bottom - childBox.bottom,
          right: box.right - childBox.right,
        };
      });
    }
    return [
      ...Array.from(document.querySelectorAll("[data-picker], [data-copy-field]")).map(
        (element) => insets(element),
      ),
    ];
  });
  expect(contained.length).toBeGreaterThan(0);
  for (const children of contained) {
    expect(children.length).toBeGreaterThan(0);
    for (const inset of children) {
      expect(inset.top).toBeGreaterThanOrEqual(1);
      expect(inset.left).toBeGreaterThanOrEqual(1);
      expect(inset.bottom).toBeGreaterThanOrEqual(1);
      expect(inset.right).toBeGreaterThanOrEqual(1);
    }
  }

  const touch = page.getByRole("button", { name: "Touch" });
  await expect(touch).toHaveCSS("height", "48px");
  const icon = page.getByRole("button", { name: "More options" });
  const iconBox = await icon.boundingBox();
  expect(iconBox?.width).toBeGreaterThanOrEqual(44);
  expect(iconBox?.height).toBeGreaterThanOrEqual(44);

  const families = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].map((font) => `${font.family} ${font.weight} ${font.status}`);
  });
  const inter = families.filter((font) => font.startsWith("Inter "));
  expect(inter.some((font) => font.includes("400") && font.includes("loaded"))).toBe(true);
  expect(inter.some((font) => font.includes("500") && font.includes("loaded"))).toBe(true);
  expect(inter.some((font) => /\b600\b/.test(font))).toBe(false);

  const colours = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("body *")].filter(
      (element) =>
        !element.closest("nextjs-portal") &&
        element.tagName !== "NEXTJS-PORTAL" &&
        element.tagName !== "SCRIPT",
    );
    return nodes.flatMap((element) => {
      const style = getComputedStyle(element);
      const colours = [style.color, style.backgroundColor];
      if (parseFloat(style.borderTopWidth) > 0) colours.push(style.borderTopColor);
      const shadow = style.boxShadow;
      const floating = Boolean(
        element.closest("[role='menu'], [role='dialog'], [data-toast], .shadow-pop, .shadow-float, .shadow-dialog"),
      );
      return [{ colours, shadow, floating, tag: element.tagName }];
    });
  });
  const offenders: string[] = [];
  for (const entry of colours) {
    for (const colour of entry.colours) {
      const value = normalise(colour);
      if (!allowedColours.has(value) && value !== "rgba(0, 0, 0, 0)") {
        offenders.push(`${entry.tag} ${value}`);
      }
    }
    if (entry.shadow !== "none" && !entry.floating) {
      offenders.push(`shadow ${entry.tag} ${entry.shadow}`);
    }
  }
  expect(offenders).toEqual([]);

  const weights = await page.evaluate(() => {
    return [...document.querySelectorAll("#app-root *")]
      .map((element) => getComputedStyle(element).fontWeight)
      .filter((weight) => weight !== "400" && weight !== "500" && weight !== "normal");
  });
  expect(weights).toEqual([]);

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  let sawInkRing = false;
  for (let step = 0; step < 400; step += 1) {
    await page.keyboard.press("Tab");
    const ring = await ringOf(page);
    if (!ring) break;
    if (ring.skip) continue;
    expect(ring.solid, ring.text).toBe(true);
    if (ring.onInk) {
      expect(normalise(ring.colour)).toBe("rgba(255, 255, 255, 0.6)");
      sawInkRing = true;
    }
    if (ring.text === "Undo" && ring.onInk) break;
  }
  expect(sawInkRing).toBe(true);
});

test("mobile gallery stays on the page and uses real mobile panels", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/dev/ui");

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
  }));
  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
  expect(metrics.innerWidth).toBe(393);
  expect(metrics.scrollWidth).toBe(393);

  const targets = page.locator(
    "[data-frame='mobile'] button, [data-frame='mobile'] a, [data-frame='mobile'] [role='switch']",
  );
  const count = await targets.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    const insideToast = await target.evaluate((element) =>
      Boolean(element.closest("[data-toast]")),
    );
    if (insideToast) continue;
    const box = await target.boundingBox();
    if (!box) continue;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  for (const name of ["Left edge", "Right edge"]) {
    const trigger = page.getByRole("button", { name });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const menu = page.getByRole("menu");
    await expect(menu).toHaveCount(1);
    await expect.poll(async () => {
      const box = await menu.boundingBox();
      if (!box) return false;
      return (
        box.x >= 8 &&
        box.x + box.width <= 385 &&
        box.y >= 8 &&
        box.y + box.height <= 844
      );
    }).toBe(true);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  }

  const sheet = page.locator("[data-inline='sheet']");
  const sheetLeft = await sheet.evaluate((element) => element.getBoundingClientRect().left);
  const parts = [
    sheet.getByRole("heading", { name: "Publish Riverton House" }),
    sheet.getByText("Last published 10 Nov, 17:20"),
    sheet.getByText("Live at", { exact: true }),
    sheet.locator("[data-copy-field]"),
    sheet.locator("[data-sheet-row]").first(),
    sheet.getByRole("button", { name: "Publish", exact: true }),
  ];
  for (const part of parts) {
    const left = await part.evaluate((element) => element.getBoundingClientRect().left);
    expect(Math.round(left - sheetLeft)).toBe(24);
  }
  await expect(sheet.getByRole("button", { name: "Publish", exact: true })).toHaveCSS("height", "48px");
  await expect(sheet.locator("[data-sheet-row]").first()).toHaveCSS("height", "56px");
  await expect(sheet.getByText("Last published 10 Nov, 17:20")).toHaveCSS("font-size", "14px");

  const input = sheet.locator("input");
  await sheet.getByText("Live at", { exact: true }).click();
  await expect(input).toBeFocused();

  const back = page
    .locator("[data-frame='mobile'] header")
    .filter({ hasText: "Home" })
    .getByRole("button", { name: "Sites" });
  const backBox = await back.boundingBox();
  expect(backBox?.height).toBeGreaterThanOrEqual(44);

  const detailHeader = page
    .locator("[data-frame='mobile'] header")
    .filter({ has: page.getByRole("button", { name: "Back", exact: true }) });
  await expect(detailHeader).toHaveCSS("height", "44px");
  const detail = page.getByRole("button", { name: "Back", exact: true });
  await expect(detail).toBeVisible();
  const detailBox = await detail.boundingBox();
  expect(detailBox?.height).toBeGreaterThanOrEqual(44);

  const tab = page.locator("[data-frame='mobile']").getByRole("link", { name: "Account", exact: true });
  const tabBox = await tab.boundingBox();
  expect(tabBox?.height).toBeGreaterThanOrEqual(44);
  await tab.click();
  await expect(page).toHaveURL(/#account$/);

  await page.getByRole("button", { name: "Open publish sheet" }).dispatchEvent("click");
  const liveSheet = page.locator("[role='dialog'][aria-modal='true']");
  await expect(liveSheet).toHaveAccessibleName("Publish Riverton House");
  const maxHeight = await liveSheet.evaluate((element) => getComputedStyle(element).maxHeight);
  expect(maxHeight).not.toBe("none");
  const scrolls = await liveSheet.locator("[data-sheet-body]").evaluate((element) => {
    const filler = document.createElement("div");
    filler.style.height = "2000px";
    element.appendChild(filler);
    return element.scrollHeight > element.clientHeight;
  });
  expect(scrolls).toBe(true);

  const mobileToast = page.locator("[data-frame='mobile'] [data-toast]");
  await expect(mobileToast).toHaveCSS("height", "52px");
  await expect(mobileToast).toHaveCSS("font-size", "14px");
  const oneLine = await page.locator("[data-toast]").evaluateAll((elements) =>
    elements.map((element) => {
      const text = element.querySelector("span");
      const line = text ? parseFloat(getComputedStyle(text).lineHeight) : 20;
      const lines = text ? Math.round(text.getBoundingClientRect().height / line) : 1;
      return { lines, height: parseFloat(getComputedStyle(element).height) };
    }),
  );
  for (const toast of oneLine) {
    if (toast.lines <= 1) expect(toast.height).toBe(52);
  }
});
