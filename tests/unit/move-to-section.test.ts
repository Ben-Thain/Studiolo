import { describe, expect, it } from "vitest";
import { applyCommand, layoutFor } from "@/editor/commands";
import { createHistory, undo } from "@/editor/history";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

describe("moveToSection", () => {
  const intro = "5a000000-0000-4000-8000-000000000032";
  const projects = "5a000000-0000-4000-8000-000000000039";
  const header = "5a000000-0000-4000-8000-000000000031";

  it("moves a page element, restacks mobile, and refuses the header", () => {
    const heading = rivertonHomeDoc.elements.find(
      (item) => item.name === "Heading",
    )!;
    const moved = applyCommand(rivertonHomeDoc, {
      type: "moveToSection",
      elementId: heading.id,
      sectionId: projects,
      col: 4,
      row: 2,
    });
    expect(
      moved.doc.elements.find((item) => item.id === heading.id)?.sectionId,
    ).toBe(projects);
    expect(layoutFor(moved.doc, heading.id, "desktop")).toMatchObject({
      col: 4,
      row: 2,
    });
    const refused = applyCommand(rivertonHomeDoc, {
      type: "moveToSection",
      elementId: heading.id,
      sectionId: header,
      col: 1,
      row: 1,
    });
    expect(
      refused.doc.elements.find((item) => item.id === heading.id)?.sectionId,
    ).toBe(intro);
    const history = {
      ...createHistory(),
      past: [{ inverse: moved.inverse }],
      future: [],
    };
    const undone = undo(moved.doc, history);
    expect(
      undone?.doc.elements.find((item) => item.id === heading.id)?.sectionId,
    ).toBe(intro);
  });
});
