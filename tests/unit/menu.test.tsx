// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Menu } from "@/components/ui/menu";

afterEach(() => {
  cleanup();
});

const items = [
  { id: "duplicate", label: "Duplicate" },
  { id: "view", label: "View live" },
  { id: "rename", label: "Rename", disabled: true },
  { type: "separator" as const, id: "sep" },
  { id: "delete", label: "Delete", destructive: true },
];

describe("Menu", () => {
  it("moves with the keyboard, selects, and restores focus", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu
        trigger={<button type="button">Actions</button>}
        items={items.map((item) =>
          item.id === "view" ? { ...item, onSelect } : item,
        )}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);

    const duplicate = screen.getByRole("menuitem", { name: "Duplicate" });
    expect(document.activeElement).toBe(duplicate);

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "View live" }),
    );

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Delete" }),
    );
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "View live" }),
    );

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Escape and jumps with type-ahead", async () => {
    const user = userEvent.setup();
    render(
      <Menu trigger={<button type="button">Actions</button>} items={items} />,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    await user.keyboard("v");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "View live" }),
    );
  });
});
