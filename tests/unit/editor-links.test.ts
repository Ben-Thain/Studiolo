import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import { createDoc } from "@/editor/doc";
import {
  getContentLink,
  makePageLink,
  makeUrlLink,
  pageLinksValid,
  remapPageLinks,
  setContentLink,
} from "@/editor/links";
import { rivertonHomeDoc, RIVERTON_HOME } from "../fixtures/riverton-home";

describe("links", () => {
  it("normalizes external URLs", () => {
    expect(makeUrlLink("example.com/path")).toEqual({
      kind: "url",
      value: "https://example.com/path",
    });
    expect(makeUrlLink("not a url")).toBeNull();
  });

  it("sets and clears content links", () => {
    const base = { text: "Hello", fontFamily: "Inter", fontSize: 18 };
    const withLink = setContentLink(base, makePageLink(RIVERTON_HOME));
    expect(getContentLink(withLink)).toEqual({
      kind: "page",
      value: RIVERTON_HOME,
    });
    expect(getContentLink(setContentLink(withLink, null))).toBeNull();
  });

  it("applyCommand setLink updates text and image only", () => {
    const intro = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
    const { doc } = applyCommand(rivertonHomeDoc, {
      type: "setLink",
      elementId: intro.id,
      link: makePageLink(RIVERTON_HOME),
    });
    expect(
      getContentLink(doc.elements.find((e) => e.id === intro.id)!.content)
        ?.value,
    ).toBe(RIVERTON_HOME);
    expect(() =>
      applyCommand(doc, {
        type: "setLink",
        elementId: rivertonHomeDoc.elements.find((e) => e.type === "nav")!.id,
        link: makePageLink(RIVERTON_HOME),
      }),
    ).toThrow(/only supported/);
  });

  it("validates page links and remaps on duplicate", () => {
    const doc = createDoc(rivertonHomeDoc.siteId);
    doc.pages = [...rivertonHomeDoc.pages];
    doc.elements = [
      {
        id: "30000000-0000-4000-8000-000000000001",
        pageId: RIVERTON_HOME,
        sectionId: "5a000000-0000-4000-8000-000000000032",
        type: "text",
        name: "Linky",
        content: setContentLink(
          { text: "Go", fontFamily: "Inter", fontSize: 16 },
          makePageLink(RIVERTON_HOME),
        ),
        sortOrder: 0,
      },
    ];
    expect(pageLinksValid(doc)).toBe(true);
    const remapped = remapPageLinks(
      doc.elements[0].content,
      new Map([[RIVERTON_HOME, "40000000-0000-4000-8000-000000000099"]]),
    );
    expect(getContentLink(remapped)?.value).toBe(
      "40000000-0000-4000-8000-000000000099",
    );
    doc.elements[0].content = remapped;
    doc.pages.push({
      id: "40000000-0000-4000-8000-000000000099",
      title: "Copy",
      slug: "copy",
      sortOrder: 1,
      inNav: true,
      isHome: false,
    });
    expect(pageLinksValid(doc)).toBe(true);
  });
});
