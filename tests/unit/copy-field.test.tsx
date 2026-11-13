// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyField } from "@/components/ui/copy-field";

afterEach(() => {
  cleanup();
});

describe("CopyField", () => {
  it("announces Copied in the live region", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<CopyField value="rivertonhouse.co.uk" label="Live at" />);
    const live = document.querySelector("[aria-live='polite']");

    expect(live?.textContent).toBe("");
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("rivertonhouse.co.uk");
    expect(live?.textContent).toBe("Copied");
  });
});
