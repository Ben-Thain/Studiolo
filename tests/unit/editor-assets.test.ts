import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import {
  pushHistory,
  historyMemoryBytes,
  createHistory,
} from "@/editor/history";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

const ASSET = "50000000-0000-4000-8000-000000000099";

describe("assets", () => {
  it("tracks asset metadata on the doc and stays small in history", () => {
    const hero = rivertonHomeDoc.elements.find((e) => e.name === "Hero image")!;
    const doc = {
      ...rivertonHomeDoc,
      assets: {
        [ASSET]: { path: `${rivertonHomeDoc.siteId}/draft/hero.png` },
      },
    };
    let current = doc;
    let history = createHistory();
    const baseSize = JSON.stringify(current).length;
    const result = applyCommand(current, {
      type: "updateContent",
      elementId: hero.id,
      content: { assetId: ASSET },
    });
    current = { ...result.doc, assets: doc.assets };
    history = pushHistory(history, result.inverse);
    expect(current.assets?.[ASSET]?.path).toContain("draft/hero.png");
    expect(historyMemoryBytes(history)).toBeLessThan(baseSize * 5);
  });
});
