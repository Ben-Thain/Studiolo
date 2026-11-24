import { describe, expect, it } from "vitest";
import { editorDocSchema } from "@/editor/schema";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

describe("editorDocSchema", () => {
  it("rejects javascript links embedded in stored content", () => {
    const intro = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
    const broken = {
      ...rivertonHomeDoc,
      elements: rivertonHomeDoc.elements.map((element) =>
        element.id === intro.id
          ? {
              ...element,
              content: {
                ...element.content,
                link: { kind: "url", value: "javascript:alert(1)" },
              },
            }
          : element,
      ),
    };
    expect(() => editorDocSchema.parse(broken)).toThrow();
  });
});
