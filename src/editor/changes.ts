import type { DraftChanges } from "./schema";
import type {
  DocSnapshot,
  EditorDoc,
  EditorElement,
  EditorPage,
  EditorSection,
  ElementLayout,
} from "./types";
import { applyDraftToDoc } from "./doc";

export function emptyChanges(): DraftChanges {
  return {};
}

/** Ordered merge: later upsert cancels earlier delete and vice versa. */
export function mergeChanges(a: DraftChanges, b: DraftChanges): DraftChanges {
  const mergeTable = <T extends { id: string }>(
    left: { upsert?: T[]; delete?: string[] } | undefined,
    right: { upsert?: T[]; delete?: string[] } | undefined,
  ) => {
    if (!left && !right) return undefined;
    const state = new Map<string, "upsert" | "delete">();
    const rows = new Map<string, T>();

    const apply = (patch: { upsert?: T[]; delete?: string[] } | undefined) => {
      if (!patch) return;
      for (const id of patch.delete ?? []) {
        state.set(id, "delete");
        rows.delete(id);
      }
      for (const row of patch.upsert ?? []) {
        state.set(row.id, "upsert");
        rows.set(row.id, row);
      }
    };

    apply(left);
    apply(right);

    const upsert = [...rows.values()];
    const del = [...state.entries()]
      .filter(([, kind]) => kind === "delete")
      .map(([id]) => id);

    const out: { upsert?: T[]; delete?: string[] } = {};
    if (upsert.length) out.upsert = upsert;
    if (del.length) out.delete = del;
    if (!out.upsert && !out.delete) return undefined;
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
    z_index: layout.z ?? 0,
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
    if (!before || layoutDiffers(before, layout)) {
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
    if (!before || elementDiffers(before, element)) {
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
    if (!before || sectionDiffers(before, section)) {
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
    if (!before || pageDiffers(before, page)) {
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

function layoutDiffers(a: ElementLayout, b: ElementLayout): boolean {
  return (
    a.col !== b.col ||
    a.span !== b.span ||
    a.row !== b.row ||
    a.rows !== b.rows ||
    a.hidden !== b.hidden ||
    a.placementSource !== b.placementSource ||
    (a.z ?? 0) !== (b.z ?? 0) ||
    a.elementId !== b.elementId ||
    a.breakpoint !== b.breakpoint
  );
}

function elementDiffers(a: EditorElement, b: EditorElement): boolean {
  return (
    a.pageId !== b.pageId ||
    a.sectionId !== b.sectionId ||
    a.type !== b.type ||
    a.name !== b.name ||
    a.sortOrder !== b.sortOrder ||
    JSON.stringify(a.content) !== JSON.stringify(b.content)
  );
}

function sectionDiffers(a: EditorSection, b: EditorSection): boolean {
  return (
    a.pageId !== b.pageId || a.name !== b.name || a.sortOrder !== b.sortOrder
  );
}

function pageDiffers(a: EditorPage, b: EditorPage): boolean {
  return (
    a.title !== b.title ||
    a.slug !== b.slug ||
    a.sortOrder !== b.sortOrder ||
    a.inNav !== b.inNav ||
    a.isHome !== b.isHome
  );
}

export function snapshotDoc(doc: EditorDoc): DocSnapshot {
  return {
    pages: doc.pages.map((p) => ({ ...p })),
    sections: doc.sections.map((s) => ({ ...s })),
    elements: doc.elements.map((e) => ({
      ...e,
      content: structuredClone(e.content),
    })),
    layouts: doc.layouts.map((l) => ({ ...l })),
    revision: doc.revision,
  };
}

export function restoreDoc(doc: EditorDoc, snapshot: DocSnapshot): EditorDoc {
  return {
    ...doc,
    revision: snapshot.revision,
    pages: snapshot.pages.map((p) => ({ ...p })),
    sections: snapshot.sections.map((s) => ({ ...s })),
    elements: snapshot.elements.map((e) => ({
      ...e,
      content: structuredClone(e.content),
    })),
    layouts: snapshot.layouts.map((l) => ({ ...l })),
  };
}

/** Patch that returns the doc from `after` back to `before`. */
export function inverseChanges(
  after: EditorDoc,
  before: DocSnapshot,
): DraftChanges {
  const beforeDoc = restoreDoc(after, before);
  return upsertChanges(beforeDoc, snapshotDoc(after));
}

/** Apply an undo patch without changing revision. */
export function applyInverse(doc: EditorDoc, inverse: DraftChanges): EditorDoc {
  const revision = doc.revision;
  const next = applyDraftToDoc(doc, inverse);
  next.revision = revision;
  return next;
}

export function cloneDoc(doc: EditorDoc): EditorDoc {
  return {
    siteId: doc.siteId,
    revision: doc.revision,
    pages: doc.pages.map((p) => ({ ...p })),
    sections: doc.sections.map((s) => ({ ...s })),
    elements: doc.elements.map((e) => ({
      ...e,
      content: structuredClone(e.content),
    })),
    layouts: doc.layouts.map((l) => ({ ...l })),
    assets: doc.assets
      ? Object.fromEntries(
          Object.entries(doc.assets).map(([id, row]) => [id, { ...row }]),
        )
      : undefined,
  };
}
