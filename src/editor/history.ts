/**
 * Undo / redo through inverse document snapshots (prompt 05, cap 50).
 */

import { applySnapshot } from "./commands";
import type { DocSnapshot, EditorDoc } from "./types";

export const HISTORY_CAP = 50;

export type HistoryState = {
  past: DocSnapshot[];
  future: DocSnapshot[];
};

export function createHistory(): HistoryState {
  return { past: [], future: [] };
}

export function pushHistory(
  history: HistoryState,
  before: DocSnapshot,
): HistoryState {
  const past = [...history.past, before];
  if (past.length > HISTORY_CAP) past.shift();
  return { past, future: [] };
}

export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}

export function undo(
  doc: EditorDoc,
  history: HistoryState,
): { doc: EditorDoc; history: HistoryState } | null {
  if (!canUndo(history)) return null;
  const past = [...history.past];
  const target = past.pop()!;
  const future = [snapshotFromDoc(doc), ...history.future];
  return {
    doc: applySnapshot(doc, target),
    history: { past, future },
  };
}

export function redo(
  doc: EditorDoc,
  history: HistoryState,
): { doc: EditorDoc; history: HistoryState } | null {
  if (!canRedo(history)) return null;
  const future = [...history.future];
  const target = future.shift()!;
  const past = [...history.past, snapshotFromDoc(doc)];
  return {
    doc: applySnapshot(doc, target),
    history: { past, future },
  };
}

function snapshotFromDoc(doc: EditorDoc): DocSnapshot {
  return {
    pages: structuredClone(doc.pages),
    sections: structuredClone(doc.sections),
    elements: structuredClone(doc.elements),
    layouts: structuredClone(doc.layouts),
    revision: doc.revision,
  };
}