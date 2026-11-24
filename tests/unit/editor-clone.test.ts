import { describe, expect, it } from "vitest";
import { cloneDoc, snapshotDoc } from "@/editor/changes";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

describe("cloneDoc", () => {
  it("isolates nested page and content objects", () => {
    const source = cloneDoc(rivertonHomeDoc);
    const intro = source.elements.find((e) => e.name === "Intro")!;
    intro.content.link = {
      kind: "url",
      value: "https://example.com/",
    };
    const copy = cloneDoc(source);
    copy.pages[0]!.title = "mutated";
    expect(source.pages[0]!.title).not.toBe("mutated");
    (
      copy.elements.find((e) => e.name === "Intro")!.content as { text: string }
    ).text = "mutated";
    expect((intro.content as { text: string }).text).not.toBe("mutated");
    const copiedLink = copy.elements.find((e) => e.name === "Intro")!.content
      .link as { value: string };
    copiedLink.value = "https://evil.example/";
    expect((intro.content.link as { value: string }).value).toBe(
      "https://example.com/",
    );
    const form = copy.elements.find((e) => e.type === "form")!;
    (form.content.fields as string[])[0] = "mutated-field";
    expect(
      (
        source.elements.find((e) => e.id === form.id)!.content
          .fields as string[]
      )[0],
    ).not.toBe("mutated-field");

    const snap = snapshotDoc(source);
    (
      snap.elements.find((e) => e.id === intro.id)!.content.link as {
        value: string;
      }
    ).value = "https://snap.example/";
    expect((intro.content.link as { value: string }).value).toBe(
      "https://example.com/",
    );
    (
      snap.elements.find((e) => e.id === form.id)!.content.fields as string[]
    )[0] = "snap-field";
    expect(
      (
        source.elements.find((e) => e.id === form.id)!.content
          .fields as string[]
      )[0],
    ).not.toBe("snap-field");
  });
});
