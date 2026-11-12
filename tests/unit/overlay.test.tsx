// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";

afterEach(() => {
  cleanup();
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <button type="button">After</button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete Riverton House?"
        actions={
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        }
      >
        <input aria-label="Name" />
      </Dialog>
    </>
  );
}

function SheetHarness({
  startOpen = false,
  onClose = () => undefined,
}: {
  startOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Trigger
      </button>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        title="Publish Riverton House"
      >
        <button type="button">Publish</button>
      </Sheet>
    </>
  );
}

describe("Dialog", () => {
  it("traps focus, closes on Escape, and returns focus", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const open = screen.getByRole("button", { name: "Open" });
    await user.click(open);
    const dialog = screen.getByRole("dialog", { name: "Delete Riverton House?" });
    const name = screen.getByLabelText("Name");
    expect(document.activeElement).toBe(name);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(name);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(open);
  });
});

describe("Sheet", () => {
  it("closes on Escape and returns focus", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    const trigger = screen.getByRole("button", { name: "Trigger" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes after a 120px drag and stays open after 40px", () => {
    const onClose = vi.fn();
    const view = render(<SheetHarness startOpen onClose={onClose} />);
    const handle = document.querySelector("[data-sheet-handle]");
    if (!(handle instanceof HTMLElement)) throw new Error("missing handle");
    const dragHandle = handle;

    function drag(dy: number, start: number, end: number) {
      const down = new PointerEvent("pointerdown", {
        clientY: 0,
        bubbles: true,
        button: 0,
        pointerId: 1,
      });
      Object.defineProperty(down, "timeStamp", { value: start });
      dragHandle.dispatchEvent(down);
      const up = new PointerEvent("pointerup", {
        clientY: dy,
        bubbles: true,
        button: 0,
        pointerId: 1,
      });
      Object.defineProperty(up, "timeStamp", { value: end });
      dragHandle.dispatchEvent(up);
    }

    drag(40, 0, 1000);
    expect(onClose).not.toHaveBeenCalled();

    view.rerender(<SheetHarness startOpen onClose={onClose} />);
    const next = document.querySelector("[data-sheet-handle]");
    if (!(next instanceof HTMLElement)) throw new Error("missing handle");
    const down = new PointerEvent("pointerdown", {
      clientY: 0,
      bubbles: true,
      button: 0,
      pointerId: 1,
    });
    Object.defineProperty(down, "timeStamp", { value: 0 });
    next.dispatchEvent(down);
    const up = new PointerEvent("pointerup", {
      clientY: 120,
      bubbles: true,
      button: 0,
      pointerId: 1,
    });
    Object.defineProperty(up, "timeStamp", { value: 400 });
    next.dispatchEvent(up);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("Sheet pointer cancel", () => {
  it("springs back without closing", () => {
    const onClose = vi.fn();
    render(<SheetHarness startOpen onClose={onClose} />);
    const handle = document.querySelector("[data-sheet-handle]");
    if (!(handle instanceof HTMLElement)) throw new Error("missing handle");
    fireEvent.pointerDown(handle, { clientY: 0, button: 0, pointerId: 1 });
    fireEvent.pointerCancel(handle, { clientY: 80, button: 0, pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
  });
});
