/**
 * Debounced save_draft persistence with offline queue (prompt 05).
 */

import { mergeChanges } from "./changes";
import type { DraftChanges } from "./schema";
import type { EditorDoc, SaveStatus } from "./types";

export class StaleRevisionError extends Error {
  readonly code = "ST409";
  constructor(message = "stale_revision") {
    super(message);
    this.name = "StaleRevisionError";
  }
}

export type SaveDraftFn = (args: {
  siteId: string;
  expectedRevision: number;
  changes: DraftChanges;
}) => Promise<number>;

export type PersistState = {
  status: SaveStatus;
  revision: number;
  pending: DraftChanges;
  queuedOffline: boolean;
  lastError: string | null;
};

const IDB_NAME = "studiolo-editor";
const IDB_STORE = "drafts";

export type DraftRow = {
  key: string;
  siteId: string;
  baseRevision: number;
  doc: EditorDoc;
  pending: DraftChanges;
};

export function draftKey(siteId: string): string {
  return `studiolo:draft:${siteId}`;
}

type IdbFactory = {
  open: (name: string, version: number) => IDBOpenDBRequest;
};

function idb(): IdbFactory | null {
  const factory = (globalThis as { indexedDB?: IdbFactory }).indexedDB;
  return factory ?? null;
}

async function openDb(): Promise<IDBDatabase | null> {
  const factory = idb();
  if (!factory) return null;
  return new Promise((resolve, reject) => {
    const req = factory.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readDraftRow(siteId: string): Promise<DraftRow | null> {
  const db = await openDb();
  if (!db) return null;
  const key = draftKey(siteId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as DraftRow | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** @deprecated Use readDraftRow */
export async function readPendingSave(
  siteId: string,
): Promise<{ siteId: string; revision: number; changes: DraftChanges } | null> {
  const row = await readDraftRow(siteId);
  if (!row) return null;
  return {
    siteId: row.siteId,
    revision: row.baseRevision,
    changes: row.pending,
  };
}

export async function writeDraftRow(row: DraftRow): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function writePendingSave(row: {
  siteId: string;
  revision: number;
  changes: DraftChanges;
}): Promise<void> {
  await writeDraftRow({
    key: draftKey(row.siteId),
    siteId: row.siteId,
    baseRevision: row.revision,
    doc: {
      siteId: row.siteId,
      revision: row.revision,
      pages: [],
      sections: [],
      elements: [],
      layouts: [],
    },
    pending: row.changes,
  });
}

export async function clearDraftRow(siteId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const key = draftKey(siteId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** @deprecated Use clearDraftRow */
export async function clearPendingSave(siteId: string): Promise<void> {
  await clearDraftRow(siteId);
}

export type CreatePersisterOptions = {
  siteId: string;
  initialRevision: number;
  doc: EditorDoc;
  save: SaveDraftFn;
  debounceMs?: number;
  maxWaitMs?: number;
  isOffline?: () => boolean;
  onStatus?: (state: PersistState) => void;
  persistDraft?: (row: DraftRow) => Promise<void>;
};

export type Persister = {
  getState: () => PersistState;
  getDoc: () => EditorDoc;
  queue: (changes: DraftChanges) => void;
  flush: () => Promise<void>;
  setRevision: (revision: number) => void;
  setDoc: (doc: EditorDoc) => void;
};

const DEFAULT_DEBOUNCE_MS = 800;
const DEFAULT_MAX_WAIT_MS = 5000;

export function createPersister(options: CreatePersisterOptions): Persister {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  let doc = options.doc;
  let state: PersistState = {
    status: "saved",
    revision: options.initialRevision,
    pending: {},
    queuedOffline: false,
    lastError: null,
  };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let maxTimerStarted = false;
  let inFlight: Promise<void> | null = null;
  let queuedDuringFlight = false;

  const notify = () => options.onStatus?.(state);

  const setStatus = (status: SaveStatus, lastError: string | null = null) => {
    state = { ...state, status, lastError };
    notify();
  };

  const persistLocal = async () => {
    const row: DraftRow = {
      key: draftKey(options.siteId),
      siteId: options.siteId,
      baseRevision: state.revision,
      doc,
      pending: state.pending,
    };
    await options.persistDraft?.(row);
    await writeDraftRow(row);
  };

  const clearMaxTimer = () => {
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
    maxTimerStarted = false;
  };

  const runSave = async () => {
    if (!Object.keys(state.pending).length) return;
    const batch = state.pending;
    const expectedRevision = state.revision;
    state = { ...state, pending: {} };
    notify();
    clearMaxTimer();
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    setStatus("saving");

    const attempt = async () => {
      try {
        const nextRevision = await options.save({
          siteId: options.siteId,
          expectedRevision,
          changes: batch,
        });
        state = {
          ...state,
          revision: nextRevision,
          queuedOffline: false,
          lastError: null,
        };
        doc = { ...doc, revision: nextRevision };
        setStatus("saved");
        await clearDraftRow(options.siteId);
      } catch (error) {
        if (isStale(error)) {
          state = {
            ...state,
            pending: mergeChanges({}, batch),
          };
          setStatus("error", "ST409");
          throw new StaleRevisionError();
        }
        if (isOfflineError(error, options.isOffline)) {
          state = {
            ...state,
            pending: mergeChanges(state.pending, batch),
            queuedOffline: true,
          };
          await persistLocal();
          setStatus("offline");
          return;
        }
        state = {
          ...state,
          pending: mergeChanges(batch, state.pending),
        };
        setStatus(
          "error",
          error instanceof Error ? error.message : "save_failed",
        );
        throw error;
      }
    };

    inFlight = attempt().finally(() => {
      inFlight = null;
      if (queuedDuringFlight) {
        queuedDuringFlight = false;
        void runSave();
      }
    });
    await inFlight;
  };

  const schedule = () => {
    if (!maxTimerStarted) {
      maxTimerStarted = true;
      maxTimer = setTimeout(() => {
        maxTimer = null;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        void runSave();
      }, maxWaitMs);
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void runSave();
    }, debounceMs);
  };

  return {
    getState: () => state,
    getDoc: () => doc,
    queue(changes) {
      state = {
        ...state,
        pending: mergeChanges(state.pending, changes),
      };
      notify();
      void persistLocal();
      if (inFlight) {
        queuedDuringFlight = true;
        return;
      }
      schedule();
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      clearMaxTimer();
      await runSave();
    },
    setRevision(revision) {
      state = { ...state, revision };
      doc = { ...doc, revision };
      notify();
    },
    setDoc(next) {
      doc = next;
    },
  };
}

function isStale(error: unknown): boolean {
  if (error instanceof StaleRevisionError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ST409") || message.includes("stale_revision");
}

function isOfflineError(error: unknown, isOffline?: () => boolean): boolean {
  if (isOffline?.()) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("network");
}

/** Replay any IndexedDB draft after the editor boots, rebasing onto `serverDoc`. */
export async function hydrateDraft(
  persister: Persister,
  serverDoc: EditorDoc,
): Promise<void> {
  const row = await readDraftRow(serverDoc.siteId);
  if (!row) return;
  persister.setDoc(serverDoc);
  persister.setRevision(serverDoc.revision);
  if (row.baseRevision === serverDoc.revision) {
    persister.queue(row.pending);
    return;
  }
  persister.queue(row.pending);
}

/** @deprecated Use hydrateDraft */
export async function hydratePendingSave(
  persister: Persister,
  siteId: string,
): Promise<void> {
  const row = await readDraftRow(siteId);
  if (!row) return;
  persister.setRevision(row.baseRevision);
  persister.queue(row.pending);
}
