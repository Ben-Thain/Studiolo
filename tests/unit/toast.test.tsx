// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, ToastRegion, useToast } from "@/components/ui/toast";

afterEach(() => {
  cleanup();
});

function Probe({
  duration,
  message,
}: {
  duration?: number;
  message: string;
}) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        toast({
          region: "main",
          message,
          duration,
          action: { label: "Undo", onClick: () => undefined },
        })
      }
    >
      Notify
    </button>
  );
}

function Harness({
  duration,
  message,
}: {
  duration?: number;
  message: string;
}) {
  return (
    <ToastProvider>
      <ToastRegion id="main">
        <div>Column</div>
      </ToastRegion>
      <Probe duration={duration} message={message} />
    </ToastProvider>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a live region before the first toast", () => {
    render(<Harness message="Saved" />);
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("");
  });

  it("dismisses after 6000ms and after 10000ms", async () => {
    const view = render(<Harness message="Saved" />);
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    expect(screen.getByText("Saved")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(5999);
    });
    expect(screen.getByText("Saved")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("Saved")).toBeNull();

    view.rerender(<Harness message="North Light deleted" duration={10000} />);
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    await act(async () => {
      vi.advanceTimersByTime(9999);
    });
    expect(screen.getByText("North Light deleted")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("North Light deleted")).toBeNull();
  });

  it("pauses on hover and focus, then resumes with the remaining time", async () => {
    render(<Harness message="Saved" />);
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    const toast = screen.getByText("Saved").parentElement;
    if (!toast) throw new Error("missing toast");

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.mouseEnter(toast);
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Saved")).toBeTruthy();
    fireEvent.mouseLeave(toast);
    await act(async () => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.getByText("Saved")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("Saved")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    const next = screen.getByText("Saved").parentElement;
    if (!next) throw new Error("missing toast");
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.focus(next);
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Saved")).toBeTruthy();
    fireEvent.blur(next);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText("Saved")).toBeNull();
  });
});
