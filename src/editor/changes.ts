import type { DraftChanges } from "./schema";
import type {
  DocSnapshot,
  EditorDoc,
  EditorElement,
  EditorPage,
  EditorSection,
  ElementLayout,
} from "./types";

export function emptyChanges(): DraftChanges {
  return {};
}

export function mergeChanges(a: DraftChanges, b: DraftChanges): DraftChanges {
  const mergeTable = <T extends { id: string }>(
    left: { upsert?: T[]; delete?: string[] } | undefined,
    right: { upsert?: T[]; delete?: string[] } | undefined,
  ) => {
    if (!left && !right) return undefined;
    const deletes = new Set<string>([
      ...(left?.delete ?? []),
      ...(right?.delete ?? []),
    ]);
    const upserts = new Map<string, T>();
    for (const row of left?.upsert ?? []) upserts.set(row.id, row);
    for (const row of right?.upsert ?? []) upserts.set(row.id, row);
    for (const id of deletes) upserts.delete(id);
    const out: { upsert?: T[]; delete?: string[] } = {};
    if (upserts.size) out.upsert = [...upserts.values()];
    if (deletes.size) out.delete = [...deletes];
    return out;
  };

  return {
    pages: mergeTable(a.pages, b.pages),
    sections: mergeTable(a.sections, b.sections),
    elements: mergeTable(a.elements, b.elements),
    element_layouts: mergeTable(a.element_layouts, b.element_layouts),
  };
}

function layoutRow(layout: ElementLayout) {
  return {
    id: layout.id,
    element_id: layout.elementId,
    breakpoint: layout.breakpoint,
    col_start: layout.col,
    col_span: layout.span,
    row_start: layout.row,
    row_span: layout.rows,
    hidden: layout.hidden,
    placement_source: layout.placementSource,
  };
}

function elementRow(element: EditorElement) {
  return {
    id: element.id,
    page_id: element.pageId,
    section_id: element.sectionId,
    type: element.type,
    name: element.name,
    content: element.content,
    sort_order: element.sortOrder,
  };
}

function sectionRow(section: EditorSection) {
  return {
    id: section.id,
    page_id: section.pageId,
    name: section.name,
    sort_order: section.sortOrder,
  };
}

function pageRow(page: EditorPage) {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    sort_order: page.sortOrder,
    in_nav: page.inNav,
    is_home: page.isHome,
  };
}

export function upsertChanges(
  doc: EditorDoc,
  snapshot: DocSnapshot,
): DraftChanges {
  const changes = emptyChanges();
  const touchedLayouts = new Set<string>();
  const touchedElements = new Set<string>();
  const touchedSections = new Set<string>();
  const touchedPages = new Set<string>();

  for (const layout of doc.layouts) {
    const before = snapshot.layouts.find((l) => l.id === layout.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(layout)) {
      touchedLayouts.add(layout.id);
    }
  }
  for (const layout of snapshot.layouts) {
    if (!doc.layouts.some((l) => l.id === layout.id)) {
      touchedLayouts.add(layout.id);
    }
  }

  for (const element of doc.elements) {
    const before = snapshot.elements.find((e) => e.id === element.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(element)) {
      touchedElements.add(element.id);
    }
  }
  for (const element of snapshot.elements) {
    if (!doc.elements.some((e) => e.id === element.id)) {
      touchedElements.add(element.id);
    }
  }

  for (const section of doc.sections) {
    const before = snapshot.sections.find((s) => s.id === section.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(section)) {
      touchedSections.add(section.id);
    }
  }
  for (const section of snapshot.sections) {
    if (!doc.sections.some((s) => s.id === section.id)) {
      touchedSections.add(section.id);
    }
  }

  for (const page of doc.pages) {
    const before = snapshot.pages.find((p) => p.id === page.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(page)) {
      touchedPages.add(page.id);
    }
  }
  for (const page of snapshot.pages) {
    if (!doc.pages.some((p) => p.id === page.id)) {
      touchedPages.add(page.id);
    }
  }

  const layoutUpsert = doc.layouts
    .filter((l) => touchedLayouts.has(l.id))
    .map(layoutRow);
  const layoutDelete = snapshot.layouts
    .filter(
      (l) =>
        touchedLayouts.has(l.id) && !doc.layouts.some((x) => x.id === l.id),
    )
    .map((l) => l.id);

  const elementUpsert = doc.elements
    .filter((e) => touchedElements.has(e.id))
    .map(elementRow);
  const elementDelete = snapshot.elements
    .filter(
      (e) =>
        touchedElements.has(e.id) && !doc.elements.some((x) => x.id === e.id),
    )
    .map((e) => e.id);

  const sectionUpsert = doc.sections
    .filter((s) => touchedSections.has(s.id))
    .map(sectionRow);
  const sectionDelete = snapshot.sections
    .filter(
      (s) =>
        touchedSections.has(s.id) && !doc.sections.some((x) => x.id === s.id),
    )
    .map((s) => s.id);

  const pageUpsert = doc.pages
    .filter((p) => touchedPages.has(p.id))
    .map(pageRow);
  const pageDelete = snapshot.pages
    .filter(
      (p) => touchedPages.has(p.id) && !doc.pages.some((x) => x.id === p.id),
    )
    .map((p) => p.id);

  if (layoutUpsert.length || layoutDelete.length) {
    changes.element_layouts = {
      upsert: layoutUpsert.length ? layoutUpsert : undefined,
      delete: layoutDelete.length ? layoutDelete : undefined,
    };
  }
  if (elementUpsert.length || elementDelete.length) {
    changes.elements = {
      upsert: elementUpsert.length ? elementUpsert : undefined,
      delete: elementDelete.length ? elementDelete : undefined,
    };
  }
  if (sectionUpsert.length || sectionDelete.length) {
    changes.sections = {
      upsert: sectionUpsert.length ? sectionUpsert : undefined,
      delete: sectionDelete.length ? sectionDelete : undefined,
    };
  }
  if (pageUpsert.length || pageDelete.length) {
    changes.pages = {
      upsert: pageUpsert.length ? pageUpsert : undefined,
      delete: pageDelete.length ? pageDelete : undefined,
    };
  }

  return changes;
}

export function snapshotDoc(doc: EditorDoc): DocSnapshot {
  return {
    pages: structuredClone(doc.pages),
    sections: structuredClone(doc.sections),
    elements: structuredClone(doc.elements),
    layouts: structuredClone(doc.layouts),
    revision: doc.revision,
  };
}

export function restoreDoc(doc: EditorDoc, snapshot: DocSnapshot): EditorDoc {
  return {
    ...doc,
    revision: snapshot.revision,
    pages: structuredClone(snapshot.pages),
    sections: structuredClone(snapshot.sections),
    elements: structuredClone(snapshot.elements),
    layouts: structuredClone(snapshot.layouts),
  };
}
