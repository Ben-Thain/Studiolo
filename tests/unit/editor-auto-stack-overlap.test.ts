import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import { createDoc } from "@/editor/doc";
import type { GridBox } from "@/editor/types";

const SITE = "40000000-0000-4000-8000-000000000071";
const PAGE = "40000000-0000-4000-8000-000000000072";
const SECTION = "40000000-0000-4000-8000-000000000073";
const HERO = "40000000-0000-4000-8000-000000000074";

function mobileBoxes(
  doc: ReturnType<typeof createDoc>,
  sectionId: string,
): GridBox[] {
  const ids = new Set(
    doc.elements
      .filter((element) => element.sectionId === sectionId)
      .map((e) => e.id),
  );
  return doc.layouts
    .filter(
      (layout) => layout.breakpoint === "mobile" && ids.has(layout.elementId),
    )
    .map((layout) => ({
      col: layout.col,
      span: layout.span,
      row: layout.row,
      rows: layout.rows,
    }));
}

function overlaps(a: GridBox, b: GridBox): boolean {
  const aEnd = a.row + a.rows - 1;
  const bEnd = b.row + b.rows - 1;
  return aEnd >= b.row && bEnd >= a.row;
}

describe("appendMobileStack overlap", () => {
  it("places new text below a tall hero image on mobile", () => {
    let doc = createDoc(SITE, 0);
    doc.pages.push({
      id: PAGE,
      title: "Home",
      slug: "",
      sortOrder: 0,
      inNav: true,
      isHome: true,
    });
    doc.sections.push({
      id: SECTION,
      pageId: PAGE,
      name: "Intro",
      sortOrder: 0,
    });
    doc = applyCommand(
      doc,
      {
        type: "addElement",
        sectionId: SECTION,
        elementType: "image",
        name: "Hero",
        pageId: PAGE,
      },
      () => HERO,
    ).doc;

    const { doc: withText } = applyCommand(doc, {
      type: "addElement",
      sectionId: SECTION,
      elementType: "text",
      name: "Caption",
      pageId: PAGE,
    });

    const boxes = mobileBoxes(withText, SECTION);
    expect(boxes.length).toBe(2);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(overlaps(boxes[i]!, boxes[j]!)).toBe(false);
      }
    }
    const hero = withText.layouts.find(
      (layout) => layout.elementId === HERO && layout.breakpoint === "mobile",
    );
    const text = withText.layouts.find(
      (layout) =>
        layout.breakpoint === "mobile" &&
        withText.elements.find((e) => e.id === layout.elementId)?.name ===
          "Caption",
    );
    expect(hero && text && text.row > hero.row + hero.rows - 1).toBe(true);
  });
});
