import { describe, expect, it } from "vitest";
import { autoStack } from "@/editor/autoStack";
import { applyCommand } from "@/editor/commands";
import { createDoc } from "@/editor/doc";
import { instantiateTemplate } from "@/templates/instantiate";
import { loadTemplate } from "@/templates/index";

describe("autoStack", () => {
  it("stacks full width with a 3-row gap, stable and non-overlapping", () => {
    const item = (
      id: string,
      sortOrder: number,
      desktop: { col: number; span: number; row: number; rows: number },
    ) => ({
      id,
      sortOrder,
      desktop,
      mobile: { col: 1, span: 12, row: 1, rows: desktop.rows },
      placementSource: "auto" as const,
    });
    const out = autoStack([
      item("b", 1, { col: 7, span: 6, row: 1, rows: 10 }),
      item("a", 0, { col: 1, span: 6, row: 1, rows: 4 }),
      item("c", 2, { col: 1, span: 6, row: 1, rows: 2 }),
    ]);
    expect([...out.entries()]).toEqual([
      ["a", { col: 1, span: 12, row: 1, rows: 4 }],
      ["c", { col: 1, span: 12, row: 8, rows: 2 }],
      ["b", { col: 1, span: 12, row: 13, rows: 10 }],
    ]);
  });

  it("restackSection keeps Intro mobile order from the starter", () => {
    let n = 0;
    const ids = () =>
      `10000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    const { changes } = instantiateTemplate(loadTemplate("blank"), {
      siteId: "20000000-0000-4000-8000-000000000099",
      siteName: "Test",
      newId: ids,
    });
    const home = changes.pages!.upsert!.find((p) => p.is_home)!;
    const intro = changes.sections!.upsert!.find((s) => s.name === "Intro")!;
    const elements = changes.elements!;
    const layouts = changes.element_layouts!;
    const doc = createDoc("20000000-0000-4000-8000-000000000001");
    doc.pages.push({
      id: home.id,
      title: home.title,
      slug: home.slug,
      sortOrder: home.sort_order,
      inNav: home.in_nav,
      isHome: home.is_home,
    });
    doc.sections.push({
      id: intro.id,
      pageId: intro.page_id,
      name: intro.name,
      sortOrder: intro.sort_order,
    });
    for (const row of elements.upsert!.filter(
      (e) => e.section_id === intro.id,
    )) {
      doc.elements.push({
        id: row.id,
        pageId: row.page_id,
        sectionId: row.section_id,
        type: row.type,
        name: row.name,
        content: row.content,
        sortOrder: row.sort_order,
      });
    }
    for (const row of layouts.upsert!) {
      if (!elements.upsert!.some((e) => e.id === row.element_id)) continue;
      doc.layouts.push({
        id: row.id,
        elementId: row.element_id,
        breakpoint: row.breakpoint,
        col: row.col_start,
        span: row.col_span,
        row: row.row_start,
        rows: row.row_span,
        hidden: row.hidden,
        placementSource: row.placement_source,
      });
    }
    const { doc: restacked } = applyCommand(doc, {
      type: "restackSection",
      sectionId: intro.id,
    });
    const mobile = (name: string) =>
      restacked.layouts.find(
        (l) =>
          l.breakpoint === "mobile" &&
          restacked.elements.find((e) => e.id === l.elementId)?.name === name,
      )!;
    expect(mobile("Heading").row).toBe(1);
    expect(mobile("Hero image").row).toBe(1 + 8 + 3);
    expect(mobile("Intro").row).toBe(1 + 8 + 3 + 40 + 3);
  });
});
