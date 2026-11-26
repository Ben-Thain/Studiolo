import { describe, expect, it } from "vitest";
import { applyCommand, layoutFor } from "@/editor/commands";
import { createHistory, undo } from "@/editor/history";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

describe("arrange", () => {
  it("moves an element through front, back, forward and backward, and undo restores it", () => {
    const heading = rivertonHomeDoc.elements.find(
      (item) => item.name === "Heading",
    )!;
    const front = applyCommand(rivertonHomeDoc, {
      type: "arrange",
      elementId: heading.id,
      breakpoint: "desktop",
      to: "front",
    });
    const frontZ = layoutFor(front.doc, heading.id, "desktop")?.z ?? 0;
    expect(frontZ).toBeGreaterThan(0);
    const back = applyCommand(front.doc, {
      type: "arrange",
      elementId: heading.id,
      breakpoint: "desktop",
      to: "back",
    });
    expect(layoutFor(back.doc, heading.id, "desktop")?.z).toBe(0);
    const forward = applyCommand(back.doc, {
      type: "arrange",
      elementId: heading.id,
      breakpoint: "desktop",
      to: "forward",
    });
    expect(
      layoutFor(forward.doc, heading.id, "desktop")?.z ?? 0,
    ).toBeGreaterThan(0);
    const backward = applyCommand(forward.doc, {
      type: "arrange",
      elementId: heading.id,
      breakpoint: "desktop",
      to: "backward",
    });
    expect(layoutFor(backward.doc, heading.id, "desktop")?.z).toBe(0);
    const undone = undo(backward.doc, {
      ...createHistory(),
      past: [{ inverse: backward.inverse }],
      future: [],
    });
    expect(layoutFor(undone!.doc, heading.id, "desktop")?.z).toBe(
      layoutFor(forward.doc, heading.id, "desktop")?.z,
    );
  });
});
