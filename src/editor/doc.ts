/**
 * Helpers to load EditorDoc values from save_draft-shaped data.
 */

import type { DraftChanges } from "./schema";
import type {
  EditorDoc,
  EditorElement,
  EditorPage,
  EditorSection,
  ElementLayout,
} from "./types";

type DraftRow = {
  pages?: DraftChanges["pages"];
  sections?: DraftChanges["sections"];
  elements?: DraftChanges["elements"];
  element_layouts?: DraftChanges["element_layouts"];
};

export function createDoc(siteId: string, revision = 0): EditorDoc {
  return {
    siteId,
    revision,
    pages: [],
    sections: [],
    elements: [],
    layouts: [],
  };
}

type PageRow = NonNullable<
  NonNullable<DraftChanges["pages"]>["upsert"]
>[number];

export function pageFromRow(row: PageRow): EditorPage {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    sortOrder: row.sort_order,
    inNav: row.in_nav,
    isHome: row.is_home,
  };
}

type SectionRow = NonNullable<
  NonNullable<DraftChanges["sections"]>["upsert"]
>[number];

export function sectionFromRow(row: SectionRow): EditorSection {
  return {
    id: row.id,
    pageId: row.page_id,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

type ElementRow = NonNullable<
  NonNullable<DraftChanges["elements"]>["upsert"]
>[number];

export function elementFromRow(row: ElementRow): EditorElement {
  return {
    id: row.id,
    pageId: row.page_id,
    sectionId: row.section_id,
    type: row.type,
    name: row.name,
    content: row.content,
    sortOrder: row.sort_order,
  };
}

type LayoutRow = NonNullable<
  NonNullable<DraftChanges["element_layouts"]>["upsert"]
>[number];

export function layoutFromRow(row: LayoutRow): ElementLayout {
  return {
    id: row.id,
    elementId: row.element_id,
    breakpoint: row.breakpoint,
    col: row.col_start,
    span: row.col_span,
    row: row.row_start,
    rows: row.row_span,
    hidden: row.hidden,
    placementSource: row.placement_source,
  };
}

/** Apply a changes payload onto a doc (create, update and delete). */
export function applyDraftToDoc(doc: EditorDoc, payload: DraftRow): EditorDoc {
  const next = structuredClone(doc);
  if (payload.pages?.delete) {
    next.pages = next.pages.filter((p) => !payload.pages!.delete!.includes(p.id));
  }
  for (const row of payload.pages?.upsert ?? []) {
    const page = pageFromRow(row);
    const index = next.pages.findIndex((p) => p.id === page.id);
    if (index >= 0) next.pages[index] = page;
    else next.pages.push(page);
  }

  if (payload.sections?.delete) {
    next.sections = next.sections.filter(
      (s) => !payload.sections!.delete!.includes(s.id),
    );
  }
  for (const row of payload.sections?.upsert ?? []) {
    const section = sectionFromRow(row);
    const index = next.sections.findIndex((s) => s.id === section.id);
    if (index >= 0) next.sections[index] = section;
    else next.sections.push(section);
  }

  if (payload.elements?.delete) {
    next.elements = next.elements.filter(
      (e) => !payload.elements!.delete!.includes(e.id),
    );
  }
  for (const row of payload.elements?.upsert ?? []) {
    const element = elementFromRow(row);
    const index = next.elements.findIndex((e) => e.id === element.id);
    if (index >= 0) next.elements[index] = element;
    else next.elements.push(element);
  }

  if (payload.element_layouts?.delete) {
    next.layouts = next.layouts.filter(
      (l) => !payload.element_layouts!.delete!.includes(l.id),
    );
  }
  for (const row of payload.element_layouts?.upsert ?? []) {
    const layout = layoutFromRow(row);
    const index = next.layouts.findIndex((l) => l.id === layout.id);
    if (index >= 0) next.layouts[index] = layout;
    else next.layouts.push(layout);
  }

  return next;
}