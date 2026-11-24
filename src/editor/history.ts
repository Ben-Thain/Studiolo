/**
 * Undo / redo through inverse DraftChanges patches (prompt 05, cap 50).
 */

import { applyInverse, snapshotDoc, upsertChanges } from "./changes";
import { applyDraftToDoc } from "./doc";
import type { DraftChanges } from "./schema";
import type { EditorDoc } from "./types";

export const HISTORY_CAP = 50;

export type HistoryEntry = {
  inverse: DraftChanges;
};

export type HistoryState = {
  past: HistoryEntry[];
  future: DraftChanges[];
};

export function createHistory(): HistoryState {
  return { past: [], future: [] };
}

export function pushHistory(
  history: HistoryState,
  inverse: DraftChanges,
  clearsRedo = true,
): HistoryState {
  const past = [...history.past, { inverse }];
  if (past.length > HISTORY_CAP) past.shift();
  return {
    past,
    future: clearsRedo ? [] : [...history.future],
  };
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
  const { inverse } = past.pop()!;
  const docAfter = doc;
  const nextDoc = applyInverse(docAfter, inverse);
  const forward = upsertChanges(docAfter, snapshotDoc(nextDoc));
  return {
    doc: nextDoc,
    history: { past, future: [forward, ...history.future] },
  };
}

export function redo(
  doc: EditorDoc,
  history: HistoryState,
): { doc: EditorDoc; history: HistoryState } | null {
  if (!canRedo(history)) return null;
  const future = [...history.future];
  const forward = future.shift()!;
  const beforeRedo = snapshotDoc(doc);
  const nextDoc = applyDraftToDoc(doc, forward);
  const revision = doc.revision;
  nextDoc.revision = revision;
  const inverse = upsertChanges(nextDoc, beforeRedo);
  return {
    doc: nextDoc,
    history: {
      past: [...history.past, { inverse }],
      future,
    },
  };
}

/** Rough retained bytes for history diagnostics. */
export function historyMemoryBytes(history: HistoryState): number {
  const json = JSON.stringify(history);
  return json.length;
}
