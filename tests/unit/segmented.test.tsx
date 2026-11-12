// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Segmented } from "@/components/ui/segmented";

afterEach(() => {
  cleanup();
});

function Harness() {
  const [value, setValue] = useState("desktop");
  return (
    <Segmented
      label="Preview layout"
      value={value}
      onChange={setValue}
      options={[
        { value: "desktop", label: "Desktop" },
        { value: "mobile", label: "Mobile" },
      ]}
    />
  );
}

describe("Segmented", () => {
  it("uses a roving tabindex and selects with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const desktop = screen.getByRole("radio", { name: "Desktop" });
    const mobile = screen.getByRole("radio", { name: "Mobile" });
    expect(desktop.tabIndex).toBe(0);
    expect(mobile.tabIndex).toBe(-1);

    desktop.focus();
    await user.keyboard("{ArrowRight}");
    expect(mobile).toHaveProperty("ariaChecked", "true");
    expect(document.activeElement).toBe(mobile);
    expect(mobile.tabIndex).toBe(0);
    expect(desktop.tabIndex).toBe(-1);

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(desktop);
    expect(desktop).toHaveProperty("ariaChecked", "true");
  });
});
