/**
 * Pure document commands for the headless editor (prompt 05).
 */

import { autoStack } from "./autoStack";
import { restoreDoc, snapshotDoc, upsertChanges } from "./changes";
import {
  defaultDesktopRows,
  defaultDesktopSpan,
  rowBelow,
  snapBox,
} from "./grid";
import { setContentLink } from "./links";
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
  before: DocSnapshot;
};

export function applyCommand(
  doc: EditorDoc,
  command: EditorCommand,
  newId: () => string = () => crypto.randomUUID(),
): CommandResult {
  const before = snapshotDoc(doc);
  const next = structuredClone(doc);
  switch (command.type) {
    case "addElement":
      addElement(next, command, newId);
      break;
    case "deleteElement":
      deleteElement(next, command.elementId);
      break;
    case "updateContent":
      updateContent(next, command.elementId, command.content);
      break;
    case "updateName":
      updateName(next, command.elementId, command.name);
      break;
    case "setLayout":
      setLayout(next, command.elementId, command.breakpoint, command.layout);
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
    case "restackSection":
      restackSection(next, command.sectionId);
      break;
    case "setLink":
      setLink(next, command.elementId, command.link);
      break;
    case "addPage":
      addPage(next, command, newId);
      break;
    case "updatePage":
      updatePage(next, command.pageId, command.patch);
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
  return { doc: next, changes, before };
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
    content: command.content ?? defaultContent(command.elementType),
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
      // Same row as a sibling text block when the section already has content in row 1.
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

  doc.layouts.push({
    id: newId(),
    elementId: id,
    breakpoint: "mobile",
    hidden: false,
    placementSource: "auto",
    col: 1,
    span: 12,
    row: 1,
    rows: desktop.rows,
  });

  restackSection(doc, section.id);
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
) {
  const element = elementOf(doc, elementId);
  element.content = { ...element.content, ...content };
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

function setHidden(
  doc: EditorDoc,
  elementId: string,
  breakpoint: Breakpoint,
  hidden: boolean,
) {
  const layout = layoutOf(doc, elementId, breakpoint);
  layout.hidden = hidden;
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

function restackSection(doc: EditorDoc, sectionId: string) {
  const elements = sectionElements(doc, sectionId);
  const mobileMap = autoStack(
    elements.map((e) => ({
      id: e.id,
      sortOrder: e.sortOrder,
      desktop: layoutOf(doc, e.id, "desktop"),
    })),
  );
  for (const element of elements) {
    const layout = layoutOf(doc, element.id, "mobile");
    const next = mobileMap.get(element.id)!;
    layout.col = next.col;
    layout.span = next.span;
    layout.row = next.row;
    layout.rows = next.rows;
    layout.placementSource = "auto";
  }
}

function setLink(
  doc: EditorDoc,
  elementId: string,
  link: Extract<EditorCommand, { type: "setLink" }>["link"],
) {
  const element = elementOf(doc, elementId);
  if (element.type !== "text" && element.type !== "image") {
    throw new Error("Links are only supported on text and image elements");
  }
  element.content = setContentLink(element.content, link);
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
  if (patch.sortOrder !== undefined) page.sortOrder = patch.sortOrder;
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

/** Apply a saved snapshot back onto the doc (undo / redo). */
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
