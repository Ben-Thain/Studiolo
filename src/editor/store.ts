/**
 * Save status for the editor (prompt 05).
 */

import type { SaveStatus } from "./types";

export type EditorStoreState = {
  status: SaveStatus;
  revision: number;
  lastError: string | null;
};

export type EditorStore = EditorStoreState & {
  setStatus: (status: SaveStatus, error?: string | null) => void;
  setRevision: (revision: number) => void;
  flushPendingSave: () => Promise<void>;
};

export function createEditorStore(
  flushPendingSave: () => Promise<void>,
  initialRevision = 0,
): EditorStore {
  let status: SaveStatus = "saved";
  let revision = initialRevision;
  let lastError: string | null = null;

  return {
    get status() {
      return status;
    },
    get revision() {
      return revision;
    },
    get lastError() {
      return lastError;
    },
    setStatus(next, error = null) {
      status = next;
      lastError = error;
    },
    setRevision(next) {
      revision = next;
    },
    flushPendingSave,
  };
}