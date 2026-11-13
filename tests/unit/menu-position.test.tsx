// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Menu } from "@/components/ui/menu";
import { placeFloating } from "@/components/ui/position";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const items = [
  { id: "duplicate", label: "Duplicate" },
  { id: "view", label: "View live" },
  { id: "delete", label: "Delete", destructive: true, disabled: true },
];

describe("placeFloating", () => {
  it("flips above the trigger and clamps to the viewport margin", () => {
    const placed = placeFloating({
      trigger: { top: 360, right: 393, bottom: 392, left: 350, width: 43, height: 32 },
      panel: { width: 180, height: 160 },
      gap: 4,
      viewport: { width: 393, height: 400 },
      align: "end",
    });
    expect(placed.top).toBeLessThan(360);
    expect(placed.left).toBeGreaterThanOrEqual(8);
    expect(placed.left + 180).toBeLessThanOrEqual(385);
    expect(placed.maxHeight).toBeLessThanOrEqual(400 - 16);
  });
});

describe("Menu", () => {
  it("closes on Tab and moves focus on from the trigger", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Menu trigger={<button type="button">Actions</button>} items={items} />
        <button type="button">After</button>
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();
    await user.keyboard("{Tab}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });

  it("renders a disabled destructive item in the quiet ink", async () => {
    const user = userEvent.setup();
    render(<Menu trigger={<button type="button">Actions</button>} items={items} />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    const item = screen.getByRole("menuitem", { name: "Delete" });
    expect(item.className).toContain("text-ink-4");
    expect(item.className).not.toContain("text-error");
  });

  it("flips and clamps using the trigger rect", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 393 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 400 });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.tagName === "BUTTON") {
          return {
            x: 350,
            y: 360,
            top: 360,
            left: 350,
            right: 393,
            bottom: 392,
            width: 43,
            height: 32,
            toJSON() {},
          } as DOMRect;
        }
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON() {},
        } as DOMRect;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute("role") === "menu" ? 180 : 43;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute("role") === "menu" ? 160 : 32;
      },
    );

    render(
      <Menu
        align="end"
        trigger={<button type="button">Edge</button>}
        items={items}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Edge" }));
    const menu = screen.getByRole("menu");
    const top = Number.parseFloat(menu.style.top);
    const left = Number.parseFloat(menu.style.left);
    expect(top).toBeLessThan(360);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(left + 180).toBeLessThanOrEqual(385);
  });
});
