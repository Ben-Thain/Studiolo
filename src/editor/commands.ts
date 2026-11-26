/**
 * Pure document commands for the headless editor (prompt 05).
 */

import { appendMobileStack, autoStack, type StackItem } from "./autoStack";
import { parseTextContent } from "./content";
import {
  cloneDoc,
  inverseChanges,
  restoreDoc,
  snapshotDoc,
  upsertChanges,
} from "./changes";
import {
  GRID_COLUMNS,
  defaultDesktopRows,
  defaultDesktopSpan,
  rowBelow,
  snapBox,
} from "./grid";
import { sanitizeContentLinks, setContentLink, validateLink } from "./links";
import type { DraftChanges } from "./schema";
import type { EditorCommand } from "./command-types";
import type {
  Breakpoint,
  DocSnapshot,
  EditorDoc,
  EditorElement,
  ElementLayout,
  ElementType,
  GridBox,
} from "./types";

export type { EditorCommand } from "./command-types";

export type CommandResult = {
  doc: EditorDoc;
  changes: DraftChanges;
  inverse: DraftChanges;
};

export function applyCommand(
  doc: EditorDoc,
  command: EditorCommand,
  newId: () => string = () => crypto.randomUUID(),
): CommandResult {
  const before = snapshotDoc(doc);
  const next = cloneDoc(doc);
  const pageIds = new Set(next.pages.map((p) => p.id));

  switch (command.type) {
    case "addElement":
      addElement(next, command, newId);
      break;
    case "deleteElement":
      deleteElement(next, command.elementId);
      break;
    case "duplicateElement":
      duplicateElement(next, command.elementId, newId);
      break;
    case "updateContent":
      updateContent(next, command.elementId, command.content, pageIds);
      break;
    case "updateName":
      updateName(next, command.elementId, command.name);
      break;
    case "renameLayer":
      updateName(next, command.elementId, command.name);
      break;
    case "setLayout":
      setLayout(next, command.elementId, command.breakpoint, command.layout);
      break;
    case "move":
      moveLayout(
        next,
        command.elementId,
        command.breakpoint,
        command.col,
        command.row,
      );
      break;
    case "resize":
      setLayout(next, command.elementId, command.breakpoint, {
        col: command.col,
        row: command.row,
        span: command.span,
        rows: command.rows,
      });
      break;
    case "setHidden":
      setHidden(next, command.elementId, command.breakpoint, command.hidden);
      break;
    case "reorderElement":
      reorderElement(next, command.elementId, command.sortOrder);
      break;
    case "addSection":
      addSection(next, command, newId);
      break;
    case "deleteSection":
      deleteSection(next, command.sectionId);
      break;
    case "renameSection":
      renameSection(next, command.sectionId, command.name);
      break;
    case "reorderSection":
      reorderSection(next, command.sectionId, command.sortOrder);
      break;
    case "restackSection":
      restackSection(next, command.sectionId);
      break;
    case "resetMobileAuto":
      resetMobileAuto(next, command.pageId);
      break;
    case "setLink":
      setLink(next, command.elementId, command.link, pageIds);
      break;
    case "addPage":
      addPage(next, command, newId);
      break;
    case "updatePage":
      updatePage(next, command.pageId, command.patch);
      break;
    case "setHome":
      updatePage(next, command.pageId, { isHome: true });
      break;
    case "setInNav":
      updatePage(next, command.pageId, { inNav: command.inNav });
      break;
    case "reorderPages":
      reorderPagesInDoc(next, command.pageId, command.sortOrder);
      break;
    case "deletePage":
      deletePage(next, command.pageId);
      break;
    default: {
      const _exhaustive: never = command;
      throw new Error(`Unknown command: ${JSON.stringify(_exhaustive)}`);
    }
  }

  const changes = upsertChanges(next, before);
  const inverse = inverseChanges(next, before);
  return { doc: next, changes, inverse };
}

function sectionOf(doc: EditorDoc, sectionId: string) {
  const section = doc.sections.find((s) => s.id === sectionId);
  if (!section) throw new Error("Unknown section");
  return section;
}

function elementOf(doc: EditorDoc, elementId: string) {
  const element = doc.elements.find((e) => e.id === elementId);
  if (!element) throw new Error("Unknown element");
  return element;
}

function layoutOf(doc: EditorDoc, elementId: string, breakpoint: Breakpoint) {
  const layout = doc.layouts.find(
    (l) => l.elementId === elementId && l.breakpoint === breakpoint,
  );
  if (!layout) throw new Error("Unknown layout");
  return layout;
}

function sectionElements(doc: EditorDoc, sectionId: string): EditorElement[] {
  return doc.elements
    .filter((e) => e.sectionId === sectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function lastSectionOfPage(doc: EditorDoc, pageId: string) {
  const pageSections = doc.sections
    .filter((s) => s.pageId === pageId)
    .sort((a, b) => b.sortOrder - a.sortOrder);
  return pageSections[0];
}

function desktopBoxesForElements(
  doc: EditorDoc,
  elements: EditorElement[],
): GridBox[] {
  return elements
    .map((e) => layoutOf(doc, e.id, "desktop"))
    .map((l) => ({
      col: l.col,
      span: l.span,
      row: l.row,
      rows: l.rows,
    }));
}

function stackItemsForSection(doc: EditorDoc, sectionId: string): StackItem[] {
  return sectionElements(doc, sectionId).flatMap((element) => {
    const desktop = layoutFor(doc, element.id, "desktop");
    const mobile = layoutFor(doc, element.id, "mobile");
    if (!desktop || !mobile) return [];
    return [
      {
        id: element.id,
        sortOrder: element.sortOrder,
        desktop: {
          col: desktop.col,
          span: desktop.span,
          row: desktop.row,
          rows: desktop.rows,
        },
        mobile: {
          col: mobile.col,
          span: mobile.span,
          row: mobile.row,
          rows: mobile.rows,
        },
        placementSource: mobile.placementSource,
      },
    ];
  });
}

const defaultContent = (type: ElementType): Record<string, unknown> => {
  switch (type) {
    case "text":
      return {
        text: "",
        fontFamily: "Inter",
        fontSize: 18,
        fontWeight: 400,
        align: "left",
      };
    case "image":
      return { assetId: null, alt: "", aspectLocked: true };
    case "nav":
      return {};
    case "form":
      return {
        fields: ["name", "email", "message"],
        buttonLabel: "Send",
      };
  }
};

function addElement(
  doc: EditorDoc,
  command: Extract<EditorCommand, { type: "addElement" }>,
  newId: () => string,
) {
  const section = sectionOf(doc, command.sectionId);
  const pageId = command.pageId ?? section.pageId;
  const id = newId();
  const sortOrder =
    command.sortOrder ??
    Math.max(-1, ...sectionElements(doc, section.id).map((e) => e.sortOrder)) +
      1;

  const element: EditorElement = {
    id,
    pageId,
    sectionId: section.id,
    type: command.elementType,
    name: command.name ?? command.elementType,
    content:
      command.elementType === "text"
        ? parseTextContent({
            ...defaultContent("text"),
            ...(command.content ?? {}),
          })
        : (command.content ?? defaultContent(command.elementType)),
    sortOrder,
  };
  doc.elements.push(element);

  const { col, span } = defaultDesktopSpan(command.elementType);
  const rows = defaultDesktopRows(command.elementType);

  let row = 1;
  const existingInSection = sectionElements(doc, section.id).filter(
    (e) => e.id !== id,
  );
  const sectionBoxes = desktopBoxesForElements(doc, existingInSection);
  if (command.elementType === "image" && pageId) {
    const lastSection = lastSectionOfPage(doc, pageId);
    const lastElements = (
      lastSection
        ? sectionElements(doc, lastSection.id)
        : sectionElements(doc, section.id)
    ).filter((e) => e.id !== id);
    row = rowBelow(desktopBoxesForElements(doc, lastElements), 0);
  } else if (sectionBoxes.length) {
    row = rowBelow(sectionBoxes, command.elementType === "text" ? 0 : 0);
    if (
      command.elementType === "image" &&
      sectionBoxes.some((b) => b.row === row)
    ) {
      const topRow = Math.min(...sectionBoxes.map((b) => b.row));
      row = topRow;
    }
  }

  const desktop = snapBox({ col, span, row, rows });
  doc.layouts.push({
    id: newId(),
    elementId: id,
    breakpoint: "desktop",
    hidden: false,
    placementSource: "manual",
    ...desktop,
  });

  const mobileStack = appendMobileStack(
    stackItemsForSection(doc, section.id).filter((i) => i.id !== id),
    { id, rows: desktop.rows },
  );

  doc.layouts.push({
    id: newId(),
    elementId: id,
    breakpoint: "mobile",
    hidden: false,
    placementSource: "auto",
    ...mobileStack,
  });
}

function duplicateElement(
  doc: EditorDoc,
  elementId: string,
  newId: () => string,
) {
  const source = elementOf(doc, elementId);
  addElement(
    doc,
    {
      type: "addElement",
      sectionId: source.sectionId,
      elementType: source.type,
      name: `${source.name} copy`,
      content: { ...source.content },
      pageId: source.pageId,
      sortOrder: source.sortOrder + 1,
    },
    newId,
  );
}

function deleteElement(doc: EditorDoc, elementId: string) {
  elementOf(doc, elementId);
  doc.elements = doc.elements.filter((e) => e.id !== elementId);
  doc.layouts = doc.layouts.filter((l) => l.elementId !== elementId);
}

function updateContent(
  doc: EditorDoc,
  elementId: string,
  content: Record<string, unknown>,
  pageIds: Set<string>,
) {
  const element = elementOf(doc, elementId);
  if (element.type === "text") {
    const previous = String((element.content as { text?: string }).text ?? "");
    const { link, ...rest } = content;
    const parsed = parseTextContent({
      ...(element.content as Record<string, unknown>),
      ...rest,
    });
    const merged: Record<string, unknown> =
      link === undefined
        ? { ...(parsed as unknown as Record<string, unknown>) }
        : { ...(parsed as unknown as Record<string, unknown>), link };
    if ("text" in content && content.text !== previous) {
      delete merged.sample;
    }
    element.content = sanitizeContentLinks(merged, pageIds);
    return;
  }
  const previousAsset =
    element.type === "image"
      ? (element.content as { assetId?: string | null }).assetId
      : undefined;
  const merged: Record<string, unknown> = {
    ...element.content,
    ...content,
  };
  if (
    element.type === "image" &&
    "assetId" in content &&
    content.assetId !== previousAsset
  ) {
    delete merged.sample;
  }
  element.content = sanitizeContentLinks(merged, pageIds);
}

function updateName(doc: EditorDoc, elementId: string, name: string) {
  const element = elementOf(doc, elementId);
  element.name = name;
}

function setLayout(
  doc: EditorDoc,
  elementId: string,
  breakpoint: Breakpoint,
  patch: Partial<GridBox & { hidden: boolean }>,
) {
  const layout = layoutOf(doc, elementId, breakpoint);
  const box = snapBox({
    col: patch.col ?? layout.col,
    span: patch.span ?? layout.span,
    row: patch.row ?? layout.row,
    rows: patch.rows ?? layout.rows,
  });
  layout.col = box.col;
  layout.span = box.span;
  layout.row = box.row;
  layout.rows = box.rows;
  if (patch.hidden !== undefined) layout.hidden = patch.hidden;
  layout.placementSource = "manual";
}

function moveLayout(
  doc: EditorDoc,
  elementId: string,
  breakpoint: Breakpoint,
  col: number,
  row: number,
) {
  const layout = layoutOf(doc, elementId, breakpoint);
  const maxCol = GRID_COLUMNS - layout.span + 1;
  layout.col = Math.min(maxCol, Math.max(1, Math.round(col)));
  layout.row = Math.max(1, Math.round(row));
  layout.placementSource = "manual";
}

function setHidden(
  doc: EditorDoc,
  elementId: string,
  breakpoint: Breakpoint,
  hidden: boolean,
) {
  const layout = layoutOf(doc, elementId, breakpoint);
  layout.hidden = hidden;
  if (breakpoint === "mobile") layout.placementSource = "manual";
}

function reorderElement(doc: EditorDoc, elementId: string, sortOrder: number) {
  const element = elementOf(doc, elementId);
  element.sortOrder = sortOrder;
}

function addSection(
  doc: EditorDoc,
  command: Extract<EditorCommand, { type: "addSection" }>,
  newId: () => string,
) {
  const sortOrder =
    command.sortOrder ??
    Math.max(
      -1,
      ...doc.sections
        .filter((s) => s.pageId === command.pageId)
        .map((s) => s.sortOrder),
    ) + 1;
  doc.sections.push({
    id: newId(),
    pageId: command.pageId,
    name: command.name,
    sortOrder,
  });
}

function deleteSection(doc: EditorDoc, sectionId: string) {
  const elementIds = doc.elements
    .filter((e) => e.sectionId === sectionId)
    .map((e) => e.id);
  doc.sections = doc.sections.filter((s) => s.id !== sectionId);
  doc.elements = doc.elements.filter((e) => e.sectionId !== sectionId);
  doc.layouts = doc.layouts.filter((l) => !elementIds.includes(l.elementId));
}

function renameSection(doc: EditorDoc, sectionId: string, name: string) {
  sectionOf(doc, sectionId).name = name;
}

function reorderSection(doc: EditorDoc, sectionId: string, sortOrder: number) {
  const section = sectionOf(doc, sectionId);
  const other = doc.sections.find(
    (item) =>
      item.id !== section.id &&
      item.pageId === section.pageId &&
      item.sortOrder === sortOrder,
  );
  const previous = section.sortOrder;
  section.sortOrder = sortOrder;
  if (other) other.sortOrder = previous;
}

function restackSection(doc: EditorDoc, sectionId: string) {
  const items = stackItemsForSection(doc, sectionId);
  const mobileMap = autoStack(items);
  for (const element of sectionElements(doc, sectionId)) {
    const layout = layoutOf(doc, element.id, "mobile");
    const next = mobileMap.get(element.id);
    if (!next) continue;
    if (layout.placementSource === "manual") continue;
    layout.col = next.col;
    layout.span = next.span;
    layout.row = next.row;
    layout.rows = next.rows;
    layout.placementSource = "auto";
  }
}

function reorderPagesInDoc(doc: EditorDoc, pageId: string, newIndex: number) {
  const sorted = [...doc.pages].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentIndex = sorted.findIndex((p) => p.id === pageId);
  if (currentIndex === -1) throw new Error("Unknown page");
  const [moved] = sorted.splice(currentIndex, 1);
  const clamped = Math.max(0, Math.min(newIndex, sorted.length));
  sorted.splice(clamped, 0, moved);
  sorted.forEach((page, index) => {
    page.sortOrder = index;
  });
}

function resetMobileAuto(doc: EditorDoc, pageId: string) {
  const sectionIds = doc.sections
    .filter((s) => s.pageId === pageId)
    .map((s) => s.id);
  for (const sectionId of sectionIds) {
    for (const item of stackItemsForSection(doc, sectionId)) {
      const layout = layoutOf(doc, item.id, "mobile");
      layout.placementSource = "auto";
    }
    restackSection(doc, sectionId);
  }
}

function setLink(
  doc: EditorDoc,
  elementId: string,
  link: Extract<EditorCommand, { type: "setLink" }>["link"],
  pageIds: Set<string>,
) {
  const element = elementOf(doc, elementId);
  if (element.type !== "text" && element.type !== "image") {
    throw new Error("Links are only supported on text and image elements");
  }
  if (link === null) {
    element.content = setContentLink(element.content, null);
    return;
  }
  const valid = validateLink(link, pageIds);
  if (!valid) throw new Error("Invalid link");
  element.content = setContentLink(element.content, valid);
}

function addPage(
  doc: EditorDoc,
  command: Extract<EditorCommand, { type: "addPage" }>,
  newId: () => string,
) {
  const sortOrder =
    command.sortOrder ?? Math.max(-1, ...doc.pages.map((p) => p.sortOrder)) + 1;
  doc.pages.push({
    id: newId(),
    title: command.title,
    slug: command.slug,
    sortOrder,
    inNav: command.inNav ?? true,
    isHome: command.isHome ?? false,
  });
}

function updatePage(
  doc: EditorDoc,
  pageId: string,
  patch: Extract<EditorCommand, { type: "updatePage" }>["patch"],
) {
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) throw new Error("Unknown page");
  if (patch.title !== undefined) page.title = patch.title;
  if (patch.slug !== undefined) page.slug = patch.slug;
  if (patch.inNav !== undefined) page.inNav = patch.inNav;
  if (patch.isHome !== undefined) {
    if (patch.isHome) {
      for (const other of doc.pages) {
        if (other.id !== pageId) other.isHome = false;
      }
    }
    page.isHome = patch.isHome;
  }
}

function deletePage(doc: EditorDoc, pageId: string) {
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) throw new Error("Unknown page");
  if (page.isHome) throw new Error("Cannot delete the home page");
  const sectionIds = doc.sections
    .filter((s) => s.pageId === pageId)
    .map((s) => s.id);
  for (const sectionId of sectionIds) deleteSection(doc, sectionId);
  doc.sections = doc.sections.filter((s) => s.pageId !== pageId);
  doc.elements = doc.elements.filter((e) => e.pageId !== pageId);
  doc.pages = doc.pages.filter((p) => p.id !== pageId);
}

/** Apply a saved snapshot back onto the doc (legacy helper). */
export function applySnapshot(
  doc: EditorDoc,
  snapshot: DocSnapshot,
): EditorDoc {
  return restoreDoc(doc, snapshot);
}

export function layoutFor(
  doc: EditorDoc,
  elementId: string,
  breakpoint: Breakpoint,
): ElementLayout | undefined {
  return doc.layouts.find(
    (l) => l.elementId === elementId && l.breakpoint === breakpoint,
  );
}
