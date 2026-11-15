/**
 * The starter content of a new site (prompt 04a), as a save_draft changes
 * document (prompt 02): pages Home and Contact, a site-wide Header (site name
 * text + nav), Home "Intro" (heading, intro text, empty hero image) and a
 * Contact section (heading + form).
 *
 * Desktop placements follow the prompt 05 add defaults (text in columns 1–6,
 * images in 7–12 at the same row, 8px rows). Mobile is the prompt 05
 * auto-stack: reading order by desktop row, then column, then sort order,
 * full width, a 3-row gap, placement_source "auto".
 */

type Id = () => string;

export type StarterLayout = {
  id: string;
  element_id: string;
  breakpoint: "desktop" | "mobile";
  col_start: number;
  col_span: number;
  row_start: number;
  row_span: number;
  hidden: boolean;
  placement_source: "auto" | "manual";
};

export type StarterChanges = {
  pages: {
    upsert: {
      id: string;
      title: string;
      slug: string;
      sort_order: number;
      in_nav: boolean;
      is_home: boolean;
    }[];
  };
  sections: {
    upsert: {
      id: string;
      page_id: string | null;
      name: string;
      sort_order: number;
    }[];
  };
  elements: {
    upsert: {
      id: string;
      page_id: string | null;
      section_id: string;
      type: "text" | "image" | "nav" | "form";
      name: string;
      content: Record<string, unknown>;
      sort_order: number;
    }[];
  };
  element_layouts: { upsert: StarterLayout[] };
};

type Box = { col: number; span: number; row: number; rows: number };

/** Mobile auto-stack for one section's elements (prompt 05). */
export function autoStack(
  items: { id: string; sortOrder: number; desktop: Box }[],
): Map<string, Box> {
  const ordered = [...items].sort(
    (a, b) =>
      a.desktop.row - b.desktop.row ||
      a.desktop.col - b.desktop.col ||
      a.sortOrder - b.sortOrder,
  );
  const out = new Map<string, Box>();
  let row = 1;
  for (const item of ordered) {
    out.set(item.id, { col: 1, span: 12, row, rows: item.desktop.rows });
    row += item.desktop.rows + 3;
  }
  return out;
}

const text = (
  value: string,
  fontSize: number,
  fontWeight: 400 | 500,
): Record<string, unknown> => ({
  text: value,
  fontFamily: "Inter",
  fontSize,
  fontWeight,
  align: "left",
});

export function starterChanges(
  siteName: string,
  newId: Id = () => crypto.randomUUID(),
): { changes: StarterChanges; homePageId: string } {
  const home = newId();
  const contact = newId();
  const header = newId();
  const intro = newId();
  const contactSection = newId();

  const elements: (StarterChanges["elements"]["upsert"][number] & {
    desktop: Box;
  })[] = [
    {
      id: newId(),
      page_id: null,
      section_id: header,
      type: "text",
      name: "Site name",
      content: text(siteName, 16, 500),
      sort_order: 0,
      desktop: { col: 1, span: 6, row: 1, rows: 4 },
    },
    {
      id: newId(),
      page_id: null,
      section_id: header,
      type: "nav",
      name: "Menu",
      content: {},
      sort_order: 1,
      desktop: { col: 7, span: 6, row: 1, rows: 4 },
    },
    {
      id: newId(),
      page_id: home,
      section_id: intro,
      type: "text",
      name: "Heading",
      content: text("Your heading", 40, 500),
      sort_order: 0,
      desktop: { col: 1, span: 6, row: 1, rows: 8 },
    },
    {
      id: newId(),
      page_id: home,
      section_id: intro,
      type: "text",
      name: "Intro",
      content: text("A line or two about what you do.", 18, 400),
      sort_order: 1,
      desktop: { col: 1, span: 6, row: 10, rows: 6 },
    },
    {
      id: newId(),
      page_id: home,
      section_id: intro,
      type: "image",
      name: "Hero image",
      content: { assetId: null, alt: "", aspectLocked: true },
      sort_order: 2,
      desktop: { col: 7, span: 6, row: 1, rows: 40 },
    },
    {
      id: newId(),
      page_id: contact,
      section_id: contactSection,
      type: "text",
      name: "Heading",
      content: text("Contact", 40, 500),
      sort_order: 0,
      desktop: { col: 1, span: 6, row: 1, rows: 8 },
    },
    {
      id: newId(),
      page_id: contact,
      section_id: contactSection,
      type: "form",
      name: "Form",
      content: { fields: ["name", "email", "message"], buttonLabel: "Send" },
      sort_order: 1,
      desktop: { col: 1, span: 6, row: 10, rows: 40 },
    },
  ];

  const layouts: StarterLayout[] = [];
  for (const section of [header, intro, contactSection]) {
    const mine = elements.filter((e) => e.section_id === section);
    const mobile = autoStack(
      mine.map((e) => ({
        id: e.id,
        sortOrder: e.sort_order,
        desktop: e.desktop,
      })),
    );
    for (const e of mine) {
      const m = mobile.get(e.id)!;
      layouts.push(
        {
          id: newId(),
          element_id: e.id,
          breakpoint: "desktop",
          col_start: e.desktop.col,
          col_span: e.desktop.span,
          row_start: e.desktop.row,
          row_span: e.desktop.rows,
          hidden: false,
          placement_source: "manual",
        },
        {
          id: newId(),
          element_id: e.id,
          breakpoint: "mobile",
          col_start: m.col,
          col_span: m.span,
          row_start: m.row,
          row_span: m.rows,
          hidden: false,
          placement_source: "auto",
        },
      );
    }
  }

  return {
    homePageId: home,
    changes: {
      pages: {
        upsert: [
          {
            id: home,
            title: "Home",
            slug: "home",
            sort_order: 0,
            in_nav: true,
            is_home: true,
          },
          {
            id: contact,
            title: "Contact",
            slug: "contact",
            sort_order: 1,
            in_nav: true,
            is_home: false,
          },
        ],
      },
      sections: {
        upsert: [
          { id: header, page_id: null, name: "Header", sort_order: 0 },
          { id: intro, page_id: home, name: "Intro", sort_order: 1 },
          {
            id: contactSection,
            page_id: contact,
            name: "Contact",
            sort_order: 1,
          },
        ],
      },
      elements: {
        upsert: elements.map((e) => ({
          id: e.id,
          page_id: e.page_id,
          section_id: e.section_id,
          type: e.type,
          name: e.name,
          content: e.content,
          sort_order: e.sort_order,
        })),
      },
      element_layouts: { upsert: layouts },
    },
  };
}
