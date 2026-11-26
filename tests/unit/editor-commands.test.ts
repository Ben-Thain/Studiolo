import { describe, expect, it } from "vitest";
import { applyCommand, layoutFor } from "@/editor/commands";
import { createDoc } from "@/editor/doc";
import { instantiateTemplate } from "@/templates/instantiate";
import { loadTemplate } from "@/templates/index";
import { RIVERTON_HOME, rivertonHomeDoc } from "../fixtures/riverton-home";

let n = 0;
const ids = () => `90000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

describe("riverton fixture", () => {
  it("has Header, Intro (Heading, Intro, Hero) and three project images", () => {
    expect(rivertonHomeDoc.sections.map((s) => [s.name, s.pageId])).toEqual([
      ["Header", null],
      ["Intro", RIVERTON_HOME],
      ["Projects", RIVERTON_HOME],
      ["Form", "5a000000-0000-4000-8000-000000000024"],
    ]);
    const intro = rivertonHomeDoc.elements.filter(
      (e) => e.sectionId === "5a000000-0000-4000-8000-000000000032",
    );
    expect(intro.map((e) => [e.type, e.name]).sort()).toEqual([
      ["image", "Hero image"],
      ["text", "Heading"],
      ["text", "Intro"],
    ]);
    const projects = rivertonHomeDoc.elements.filter(
      (e) => e.sectionId === "5a000000-0000-4000-8000-000000000039",
    );
    expect(projects.filter((e) => e.type === "image")).toHaveLength(3);
  });
});

describe("applyCommand", () => {
  it("addElement defaults text and images to the converted 96-column spans", () => {
    const { changes, homePageId } = instantiateTemplate(loadTemplate("blank"), {
      siteId: "80000000-0000-4000-8000-000000000099",
      siteName: "Add test",
      newId: ids,
    });
    const header = changes.sections!.upsert!.find((s) => s.name === "Header")!;
    const intro = changes.sections!.upsert!.find((s) => s.name === "Intro")!;
    const doc = createDoc("80000000-0000-4000-8000-000000000001");
    doc.pages = changes.pages!.upsert!.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      sortOrder: p.sort_order,
      inNav: p.in_nav,
      isHome: p.is_home,
    }));
    doc.sections = changes.sections!.upsert!.map((s) => ({
      id: s.id,
      pageId: s.page_id,
      name: s.name,
      sortOrder: s.sort_order,
    }));
    doc.elements = changes.elements!.upsert!.map((e) => ({
      id: e.id,
      pageId: e.page_id,
      sectionId: e.section_id,
      type: e.type,
      name: e.name,
      content: e.content,
      sortOrder: e.sort_order,
    }));
    doc.layouts = changes.element_layouts!.upsert!.map((l) => ({
      id: l.id,
      elementId: l.element_id,
      breakpoint: l.breakpoint,
      col: l.col_start,
      span: l.col_span,
      row: l.row_start,
      rows: l.row_span,
      hidden: l.hidden,
      placementSource: l.placement_source,
    }));

    const textAdd = applyCommand(
      doc,
      {
        type: "addElement",
        sectionId: intro.id,
        elementType: "text",
        name: "Extra",
      },
      ids,
    );
    const text = textAdd.doc.elements.find((e) => e.name === "Extra")!;
    expect(layoutFor(textAdd.doc, text.id, "desktop")).toMatchObject({
      col: 1,
      span: 47,
    });

    const imageAdd = applyCommand(
      textAdd.doc,
      {
        type: "addElement",
        sectionId: header.id,
        elementType: "image",
        name: "Logo",
        pageId: null,
      },
      ids,
    );
    const image = imageAdd.doc.elements.find((e) => e.name === "Logo")!;
    const desktop = layoutFor(imageAdd.doc, image.id, "desktop")!;
    expect(desktop.col).toBe(50);
    expect(desktop.span).toBe(47);
    expect(desktop.row).toBeGreaterThan(1);

    const pageImage = applyCommand(
      imageAdd.doc,
      {
        type: "addElement",
        sectionId: intro.id,
        elementType: "image",
        name: "Gallery",
        pageId: homePageId,
      },
      ids,
    );
    expect(
      layoutFor(
        pageImage.doc,
        pageImage.doc.elements.find((e) => e.name === "Gallery")!.id,
        "desktop",
      ),
    ).toMatchObject({
      col: 50,
      span: 47,
    });
  });

  it("setLayout and deleteElement emit changes", () => {
    const heading = rivertonHomeDoc.elements.find((e) => e.name === "Heading")!;
    const moved = applyCommand(rivertonHomeDoc, {
      type: "setLayout",
      elementId: heading.id,
      breakpoint: "desktop",
      layout: { row: 3, rows: 12 },
    });
    expect(moved.changes.element_layouts?.upsert?.[0]).toMatchObject({
      row_start: 3,
      row_span: 12,
    });

    const deleted = applyCommand(moved.doc, {
      type: "deleteElement",
      elementId: heading.id,
    });
    expect(deleted.doc.elements.some((e) => e.id === heading.id)).toBe(false);
    expect(deleted.changes.elements?.delete).toContain(heading.id);
  });

  it("site-wide section uses pageId null on elements", () => {
    const siteName = rivertonHomeDoc.elements.find(
      (e) => e.name === "Site name",
    )!;
    expect(siteName.pageId).toBeNull();
    expect(siteName.sectionId).toBe("5a000000-0000-4000-8000-000000000031");
  });
});
