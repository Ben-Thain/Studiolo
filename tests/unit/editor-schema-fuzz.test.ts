import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import { snapBox } from "@/editor/grid";
import { editorDocSchema } from "@/editor/schema";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

describe("schema", () => {
  it("snapBox rejects NaN and Infinity", () => {
    expect(snapBox({ col: NaN, span: 6, row: 1, rows: 4 })).toEqual({
      col: 1,
      span: 6,
      row: 1,
      rows: 4,
    });
    expect(snapBox({ col: 1, span: Infinity, row: 1, rows: 4 }).span).toBe(1);
  });

  it("commands always leave a valid doc", () => {
    let doc = structuredClone(rivertonHomeDoc);
    let n = 0;
    const ids = () =>
      `f0000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    const intro = doc.sections.find((s) => s.name === "Intro")!;
    const heading = doc.elements.find((e) => e.name === "Heading")!;
    const steps = [
      () =>
        applyCommand(doc, {
          type: "updateContent",
          elementId: heading.id,
          content: { text: "Fuzz", fontFamily: "Inter", fontSize: 24 },
        }),
      () =>
        applyCommand(doc, {
          type: "move",
          elementId: heading.id,
          breakpoint: "desktop",
          col: 2,
          row: 2,
        }),
      () =>
        applyCommand(doc, {
          type: "addElement",
          sectionId: intro.id,
          elementType: "text",
          name: "Extra",
        }),
    ];
    for (const step of steps) {
      doc = step().doc;
      expect(editorDocSchema.safeParse(doc).success).toBe(true);
    }
    doc = applyCommand(
      doc,
      { type: "duplicateElement", elementId: heading.id },
      ids,
    ).doc;
    expect(editorDocSchema.safeParse(doc).success).toBe(true);
  });
});
