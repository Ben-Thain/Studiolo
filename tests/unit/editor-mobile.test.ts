import { describe, expect, it } from "vitest";
import { applyCommand, layoutFor } from "@/editor/commands";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

describe("mobile placement", () => {
  it("preserves manual Hero row on mobile after desktop restack", () => {
    const hero = rivertonHomeDoc.elements.find((e) => e.name === "Hero image")!;
    const mobile = layoutFor(rivertonHomeDoc, hero.id, "mobile")!;
    const manual = applyCommand(rivertonHomeDoc, {
      type: "move",
      elementId: hero.id,
      breakpoint: "mobile",
      col: 1,
      row: 50,
    });
    expect(layoutFor(manual.doc, hero.id, "mobile")?.row).toBe(50);
    expect(layoutFor(manual.doc, hero.id, "mobile")?.placementSource).toBe(
      "manual",
    );

    const { doc: restacked } = applyCommand(manual.doc, {
      type: "restackSection",
      sectionId: hero.sectionId,
    });
    expect(layoutFor(restacked, hero.id, "mobile")?.row).toBe(50);
    expect(layoutFor(restacked, hero.id, "mobile")?.rows).toBe(mobile.rows);
  });

  it("setHidden on mobile marks placement manual", () => {
    const intro = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
    const { doc } = applyCommand(rivertonHomeDoc, {
      type: "setHidden",
      elementId: intro.id,
      breakpoint: "mobile",
      hidden: true,
    });
    expect(layoutFor(doc, intro.id, "mobile")?.placementSource).toBe("manual");
  });
});
