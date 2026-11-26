import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

describe("move keeps span", () => {
  it("clamps the column at the edge and does not change span", () => {
    const image = rivertonHomeDoc.elements.find((e) => e.type === "image")!;
    const before = rivertonHomeDoc.layouts.find(
      (l) => l.elementId === image.id && l.breakpoint === "desktop",
    )!;
    const moved = applyCommand(rivertonHomeDoc, {
      type: "move",
      elementId: image.id,
      breakpoint: "desktop",
      col: 200,
      row: before.row,
    });
    const after = moved.doc.layouts.find(
      (l) => l.elementId === image.id && l.breakpoint === "desktop",
    )!;
    expect(after.span).toBe(before.span);
    expect(after.col).toBeLessThanOrEqual(96 - before.span + 1);
    expect(after.col).not.toBe(200);
  });
});
