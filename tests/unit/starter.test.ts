import { describe, expect, it } from "vitest";
import { autoStack } from "@/editor/autoStack";
import { instantiateTemplate } from "@/templates/instantiate";
import { loadTemplate } from "@/templates/index";

let n = 0;
const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

const { changes, homePageId } = instantiateTemplate(loadTemplate("blank"), {
  siteId: "00000000-0000-4000-8000-0000000000aa",
  siteName: "Hollin Field",
  newId: ids,
});

describe("instantiateTemplate(blank)", () => {
  it("creates Home (home, in nav) and Contact pages", () => {
    expect(changes.pages?.upsert).toEqual([
      expect.objectContaining({
        id: homePageId,
        title: "Home",
        slug: "home",
        is_home: true,
        in_nav: true,
      }),
      expect.objectContaining({
        title: "Contact",
        slug: "contact",
        is_home: false,
        in_nav: true,
      }),
    ]);
  });

  it("has a site-wide Header, a Home Intro and a Contact section", () => {
    const sections = changes.sections!.upsert!;
    expect(sections.map((s) => [s.name, s.page_id === null])).toEqual([
      ["Header", true],
      ["Intro", false],
      ["Contact", false],
    ]);
    const byName = (name: string) =>
      changes.elements!.upsert!.filter(
        (e) => e.section_id === sections.find((s) => s.name === name)!.id,
      );
    expect(byName("Header").map((e) => [e.type, e.content.text])).toEqual([
      ["text", "Hollin Field"],
      ["nav", undefined],
    ]);
    expect(byName("Intro").map((e) => [e.type, e.name])).toEqual([
      ["text", "Heading"],
      ["text", "Intro"],
      ["image", "Hero image"],
    ]);
    expect(byName("Intro")[0]!.content.text).toBe("Your heading");
    expect(byName("Intro")[1]!.content.text).toBe(
      "A line or two about what you do.",
    );
    expect(byName("Intro")[2]!.content).toEqual({
      assetId: null,
      alt: "",
      aspectLocked: true,
    });
    expect(byName("Contact").map((e) => [e.type, e.content.text])).toEqual([
      ["text", "Contact"],
      ["form", undefined],
    ]);
  });

  it("puts every element's page on its section's page", () => {
    for (const element of changes.elements!.upsert!) {
      const section = changes.sections!.upsert!.find(
        (s) => s.id === element.section_id,
      )!;
      expect(element.page_id).toBe(section.page_id);
    }
  });

  it("places desktop by the add defaults and mobile by auto-stack", () => {
    const layouts = changes.element_layouts!.upsert!;
    expect(layouts).toHaveLength(changes.elements!.upsert!.length * 2);
    const of = (name: string, breakpoint: string) => {
      const element = changes.elements!.upsert!.find((e) => e.name === name)!;
      return layouts.find(
        (l) => l.element_id === element.id && l.breakpoint === breakpoint,
      )!;
    };
    expect(of("Heading", "desktop")).toMatchObject({
      col_start: 1,
      col_span: 6,
      row_start: 1,
    });
    expect(of("Hero image", "desktop")).toMatchObject({
      col_start: 7,
      col_span: 6,
      row_start: 1,
    });
    for (const layout of layouts.filter((l) => l.breakpoint === "mobile")) {
      expect(layout).toMatchObject({
        col_start: 1,
        col_span: 12,
        placement_source: "auto",
      });
    }
    expect(of("Heading", "mobile").row_start).toBe(1);
    expect(of("Hero image", "mobile").row_start).toBe(1 + 8 + 3);
    expect(of("Intro", "mobile").row_start).toBe(1 + 8 + 3 + 40 + 3);
  });
});

describe("autoStack", () => {
  it("stacks full width with a 3-row gap, stable and non-overlapping", () => {
    const out = autoStack([
      {
        id: "b",
        sortOrder: 1,
        desktop: { col: 7, span: 6, row: 1, rows: 10 },
        mobile: { col: 1, span: 12, row: 1, rows: 10 },
        placementSource: "auto",
      },
      {
        id: "a",
        sortOrder: 0,
        desktop: { col: 1, span: 6, row: 1, rows: 4 },
        mobile: { col: 1, span: 12, row: 1, rows: 4 },
        placementSource: "auto",
      },
      {
        id: "c",
        sortOrder: 2,
        desktop: { col: 1, span: 6, row: 1, rows: 2 },
        mobile: { col: 1, span: 12, row: 1, rows: 2 },
        placementSource: "auto",
      },
    ]);
    expect([...out.entries()]).toEqual([
      ["a", { col: 1, span: 12, row: 1, rows: 4 }],
      ["c", { col: 1, span: 12, row: 8, rows: 2 }],
      ["b", { col: 1, span: 12, row: 13, rows: 10 }],
    ]);
  });
});
