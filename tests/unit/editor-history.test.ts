import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import {
  HISTORY_CAP,
  canRedo,
  canUndo,
  createHistory,
  historyMemoryBytes,
  pushHistory,
  redo,
  undo,
} from "@/editor/history";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

describe("history", () => {
  it("undoes and redoes a content edit", () => {
    const intro = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
    const first = applyCommand(rivertonHomeDoc, {
      type: "updateContent",
      elementId: intro.id,
      content: { text: "Changed once" },
    });
    let history = createHistory();
    history = pushHistory(history, first.inverse);
    expect(canUndo(history)).toBe(true);
    const undone = undo(first.doc, history)!;
    expect(
      undone.doc.elements.find((e) => e.id === intro.id)?.content.text,
    ).toBe(
      "A small studio in York restoring Georgian and Victorian homes since 2014.",
    );
    expect(undone.doc.revision).toBe(first.doc.revision);
    const redone = redo(undone.doc, undone.history)!;
    expect(
      redone.doc.elements.find((e) => e.id === intro.id)?.content.text,
    ).toBe("Changed once");
    expect(canRedo(undone.history)).toBe(true);
  });

  it("clears redo after a page command", () => {
    const page = rivertonHomeDoc.pages[0];
    const edit = applyCommand(rivertonHomeDoc, {
      type: "updateContent",
      elementId: rivertonHomeDoc.elements[0].id,
      content: { text: "x" },
    });
    let history = pushHistory(createHistory(), edit.inverse);
    const undone = undo(edit.doc, history)!;
    history = undone.history;
    const next = applyCommand(undone.doc, {
      type: "setInNav",
      pageId: page.id,
      inNav: false,
    });
    history = pushHistory(history, next.inverse);
    expect(canRedo(history)).toBe(false);
  });

  it("caps the undo stack at 50", () => {
    let history = createHistory();
    for (let i = 0; i < HISTORY_CAP + 5; i += 1) {
      history = pushHistory(history, {
        elements: {
          upsert: [
            {
              id: "e",
              page_id: null,
              section_id: "s",
              type: "text",
              name: "T",
              content: { text: String(i) },
              sort_order: 0,
            },
          ],
        },
      });
    }
    expect(history.past).toHaveLength(HISTORY_CAP);
  });

  it("keeps history memory under five times the doc size", () => {
    const intro = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
    let doc = rivertonHomeDoc;
    let history = createHistory();
    const baseSize = JSON.stringify(doc).length;
    for (let i = 0; i < HISTORY_CAP; i += 1) {
      const result = applyCommand(doc, {
        type: "updateContent",
        elementId: intro.id,
        content: { text: `step ${i}` },
      });
      doc = result.doc;
      history = pushHistory(history, result.inverse);
    }
    expect(historyMemoryBytes(history)).toBeLessThan(baseSize * 5);
  });

  it("applies 1500 random commands under a time budget", () => {
    const intro = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
    let doc = rivertonHomeDoc;
    const start = performance.now();
    for (let i = 0; i < 1500; i += 1) {
      doc = applyCommand(doc, {
        type: "updateContent",
        elementId: intro.id,
        content: { text: `perf ${i % 17}` },
      }).doc;
    }
    expect(performance.now() - start).toBeLessThan(5000);
  });
});
