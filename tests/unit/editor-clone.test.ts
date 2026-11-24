import { describe, expect, it } from "vitest";
import { cloneDoc } from "@/editor/changes";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

describe("cloneDoc", () => {
  it("isolates nested page and content objects", () => {
    const copy = cloneDoc(rivertonHomeDoc);
    copy.pages[0]!.title = "mutated";
    expect(rivertonHomeDoc.pages[0]!.title).not.toBe("mutated");
    const intro = copy.elements.find((e) => e.name === "Intro")!;
    (intro.content as { text: string }).text = "mutated";
    const original = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
    expect((original!.content as { text: string }).text).not.toBe("mutated");
  });
});
