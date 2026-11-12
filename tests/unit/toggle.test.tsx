// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Toggle } from "@/components/ui/toggle";

afterEach(() => {
  cleanup();
});

function Harness({ initial = false }: { initial?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return <Toggle checked={checked} onChange={setChecked} label="Password" />;
}

describe("Toggle", () => {
  it("exposes the checked state and updates it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole("switch", { name: "Password" });

    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("does not change while disabled", async () => {
    const user = userEvent.setup();
    render(
      <Toggle
        checked={false}
        disabled
        onChange={() => undefined}
        label="Password"
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Password" });
    await user.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });
});
