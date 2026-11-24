import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import { missingPageLinks } from "@/editor/links";
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

  it("stays valid when a page link target was deleted", () => {
    const target = rivertonHomeDoc.pages.find((page) => !page.isHome)!;
    const intro = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
    const linked = {
      ...rivertonHomeDoc,
      elements: rivertonHomeDoc.elements.map((element) =>
        element.id === intro.id
          ? {
              ...element,
              content: {
                ...element.content,
                link: { kind: "page" as const, value: target.id },
              },
            }
          : element,
      ),
    };
    const { doc } = applyCommand(linked, {
      type: "deletePage",
      pageId: target.id,
    });
    expect(editorDocSchema.safeParse(doc).success).toBe(true);
    expect(missingPageLinks(doc).some((row) => row.pageId === target.id)).toBe(
      true,
    );
  });
});
