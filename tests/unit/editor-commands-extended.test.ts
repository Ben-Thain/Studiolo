import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import { rivertonHomeDoc, RIVERTON_HOME } from "../fixtures/riverton-home";

let n = 0;
const ids = () => `c0000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

describe("extended commands", () => {
  it("duplicates, reorders, and toggles pages", () => {
    const heading = rivertonHomeDoc.elements.find((e) => e.name === "Heading")!;
    const dup = applyCommand(
      rivertonHomeDoc,
      { type: "duplicateElement", elementId: heading.id },
      ids,
    );
    expect(
      dup.doc.elements.filter((e) => e.name.includes("copy")),
    ).toHaveLength(1);

    const section = rivertonHomeDoc.sections.find((s) => s.name === "Intro")!;
    const reordered = applyCommand(dup.doc, {
      type: "reorderSection",
      sectionId: section.id,
      sortOrder: 9,
    });
    expect(
      reordered.doc.sections.find((s) => s.id === section.id)?.sortOrder,
    ).toBe(9);

    const added = applyCommand(
      reordered.doc,
      {
        type: "addPage",
        title: "About",
        slug: "about",
      },
      ids,
    );
    const pageId = added.doc.pages.find((p) => p.slug === "about")!.id;
    const home = applyCommand(added.doc, { type: "setHome", pageId });
    expect(home.doc.pages.find((p) => p.id === pageId)?.isHome).toBe(true);
    expect(home.doc.pages.find((p) => p.id === RIVERTON_HOME)?.isHome).toBe(
      false,
    );

    const nav = applyCommand(home.doc, {
      type: "setInNav",
      pageId,
      inNav: false,
    });
    expect(nav.doc.pages.find((p) => p.id === pageId)?.inNav).toBe(false);
  });

  it("renameLayer mirrors updateName and resetMobileAuto restacks", () => {
    const intro = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
    const renamed = applyCommand(rivertonHomeDoc, {
      type: "renameLayer",
      elementId: intro.id,
      name: "Lead",
    });
    expect(renamed.doc.elements.find((e) => e.id === intro.id)?.name).toBe(
      "Lead",
    );

    const hero = rivertonHomeDoc.elements.find((e) => e.name === "Hero image")!;
    const doc = applyCommand(renamed.doc, {
      type: "move",
      elementId: hero.id,
      breakpoint: "mobile",
      col: 1,
      row: 40,
    }).doc;
    const reset = applyCommand(doc, {
      type: "resetMobileAuto",
      pageId: RIVERTON_HOME,
    });
    expect(layoutFor(reset.doc, hero.id, "mobile")?.placementSource).toBe(
      "auto",
    );
  });
});

function layoutFor(
  doc: Parameters<typeof applyCommand>[0],
  elementId: string,
  breakpoint: "desktop" | "mobile",
) {
  return doc.layouts.find(
    (l) => l.elementId === elementId && l.breakpoint === breakpoint,
  );
}
