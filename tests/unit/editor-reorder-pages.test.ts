import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import { createHistory, pushHistory, undo } from "@/editor/history";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

function pageOrder(doc: typeof rivertonHomeDoc) {
  return [...doc.pages]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({ id: p.id, sortOrder: p.sortOrder }));
}

describe("reorderPages", () => {
  it("assigns unique sort orders 0 through n-1 and undo restores order", () => {
    let doc = rivertonHomeDoc;
    doc = applyCommand(doc, {
      type: "addPage",
      title: "About",
      slug: "about",
    }).doc;
    doc = applyCommand(doc, {
      type: "addPage",
      title: "Contact",
      slug: "contact",
    }).doc;
    const before = pageOrder(doc);
    const aboutId = doc.pages.find((p) => p.slug === "about")!.id;
    const moved = applyCommand(doc, {
      type: "reorderPages",
      pageId: aboutId,
      sortOrder: 0,
    });
    const orders = pageOrder(moved.doc).map((p) => p.sortOrder);
    expect(orders).toEqual(orders.map((_, index) => index));
    expect(new Set(orders).size).toBe(orders.length);
    const history = pushHistory(createHistory(), moved.inverse);
    const undone = undo(moved.doc, history)!;
    expect(pageOrder(undone.doc)).toEqual(before);
  });
});
