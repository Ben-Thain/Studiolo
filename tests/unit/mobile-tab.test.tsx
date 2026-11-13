// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "@/components/ui/mobile";

afterEach(() => {
  cleanup();
});

describe("MobileTabBar", () => {
  it("does not cancel navigation when a tab has an href and no onChange", async () => {
    const user = userEvent.setup();
    render(
      <MobileTabBar
        value="sites"
        tabs={[{ id: "account", label: "Account", icon: "person", href: "#account" }]}
      />,
    );
    const link = screen.getByRole("link", { name: "Account" });
    let prevented = false;
    link.addEventListener("click", (event) => {
      prevented = event.defaultPrevented;
    });
    await user.click(link);
    expect(prevented).toBe(false);
    expect(window.location.hash).toBe("#account");
  });

  it("prevents navigation only when onChange is set and the tab has no href", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MobileTabBar
        value="sites"
        onChange={onChange}
        tabs={[{ id: "account", label: "Account", icon: "person" }]}
      />,
    );
    const tab = screen.getByRole("button", { name: "Account" });
    let prevented = false;
    document.addEventListener("click", (event) => {
      prevented = event.defaultPrevented;
    });
    await user.click(tab);
    expect(prevented).toBe(true);
    expect(onChange).toHaveBeenCalledWith("account");
  });
});
