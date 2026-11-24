import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import {
  HISTORY_CAP,
  canRedo,
  canUndo,
  createHistory,
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
    history = pushHistory(history, first.before);
    expect(canUndo(history)).toBe(true);
    const undone = undo(first.doc, history)!;
    expect(
      undone.doc.elements.find((e) => e.id === intro.id)?.content.text,
    ).toBe("A small studio in York restoring Georgian and Victorian homes since 2014.");
    const redone = redo(undone.doc, undone.history)!;
    expect(redone.doc.elements.find((e) => e.id === intro.id)?.content.text).toBe(
      "Changed once",
    );
    expect(canRedo(history)).toBe(false);
  });

  it("caps the undo stack at 50", () => {
    let history = createHistory();
    for (let i = 0; i < HISTORY_CAP + 5; i += 1) {
      history = pushHistory(history, {
        pages: [],
        sections: [],
        elements: [],
        layouts: [],
        revision: i,
      });
    }
    expect(history.past).toHaveLength(HISTORY_CAP);
  });
});