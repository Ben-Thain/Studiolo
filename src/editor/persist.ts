/**
 * Debounced save_draft persistence with offline queue (prompt 05).
 */

import { mergeChanges } from "./changes";
import { applyDraftToDoc } from "./doc";
import type { DraftChanges } from "./schema";
import type { EditorDoc, SaveStatus } from "./types";

export class StaleRevisionError extends Error {
  readonly code = "ST409";
  constructor(message = "stale_revision") {
    super(message);
    this.name = "StaleRevisionError";
  }
}

export class RetryableSaveError extends Error {
  readonly code = "error";
  constructor(message = "save_failed") {
    super(message);
    this.name = "RetryableSaveError";
  }
}

export class OfflineSaveError extends Error {
  readonly code = "offline";
  constructor() {
    super("network");
    this.name = "OfflineSaveError";
  }
}

export class InvalidSaveError extends Error {
  readonly code = "invalid";
  constructor() {
    super("invalid_changes");
    this.name = "InvalidSaveError";
  }
}

export class GoneSaveError extends Error {
  readonly code = "gone";
  constructor() {
    super("site_gone");
    this.name = "GoneSaveError";
  }
}

export class AuthExpiredError extends Error {
  readonly code = "auth";
  constructor() {
    super("session_expired");
    this.name = "AuthExpiredError";
  }
}

export const SAVE_ERROR_BACKOFF_SECONDS = [2, 5, 10, 30] as const;

export function saveErrorRetryDelayMs(
  errorAttempt: number,
  backoff: readonly number[] = SAVE_ERROR_BACKOFF_SECONDS,
): number {
  return (errorAttempt < backoff.length ? backoff[errorAttempt] : 30) * 1000;
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
  /** Test seam: replace IndexedDB so fake timers are not blocked on it. */
  draftStore?: {
    write: (row: DraftRow) => Promise<void>;
    clear: (siteId: string) => Promise<void>;
  };
};

export type Persister = {
  getState: () => PersistState;
  getDoc: () => EditorDoc;
  queue: (changes: DraftChanges) => void;
  flush: () => Promise<void>;
  setRevision: (revision: number) => void;
  setDoc: (doc: EditorDoc) => void;
  dispose: () => void;
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
  let persistChain: Promise<void> = Promise.resolve();
  let errorAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

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
    await (options.draftStore?.write ?? writeDraftRow)(row);
  };

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleRetry = () => {
    clearRetry();
    const delay = saveErrorRetryDelayMs(errorAttempt);
    errorAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void runSave().catch(() => undefined);
    }, delay);
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
    await persistChain;
    await (options.draftStore?.write ?? writeDraftRow)({
      key: draftKey(options.siteId),
      siteId: options.siteId,
      baseRevision: state.revision,
      doc,
      pending: mergeChanges(batch, state.pending),
    });

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
        errorAttempt = 0;
        clearRetry();
        setStatus("saved");
        if (!Object.keys(state.pending).length) {
          await (options.draftStore?.clear ?? clearDraftRow)(options.siteId);
        } else {
          await persistLocal();
        }
      } catch (error) {
        if (isStale(error)) {
          state = {
            ...state,
            pending: mergeChanges(batch, state.pending),
          };
          await persistLocal();
          setStatus("error", "ST409");
          queuedDuringFlight = false;
          throw new StaleRevisionError();
        }
        if (isOfflineError(error, options.isOffline)) {
          state = {
            ...state,
            pending: mergeChanges(batch, state.pending),
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
        await persistLocal();
        const terminal = isTerminalSaveError(error);
        setStatus(
          "error",
          error instanceof Error ? error.message : "save_failed",
        );
        queuedDuringFlight = false;
        if (!terminal && error instanceof RetryableSaveError) {
          scheduleRetry();
        }
        throw error;
      }
    };

    inFlight = attempt().finally(() => {
      inFlight = null;
      if (queuedDuringFlight) {
        queuedDuringFlight = false;
        return runSave();
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
      persistChain = persistChain.then(() => persistLocal());
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
      clearRetry();
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
    dispose() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      clearMaxTimer();
      clearRetry();
    },
  };
}

function isStale(error: unknown): boolean {
  if (error instanceof StaleRevisionError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ST409") || message.includes("stale_revision");
}

function isOfflineError(error: unknown, isOffline?: () => boolean): boolean {
  if (error instanceof OfflineSaveError) return true;
  return isOffline?.() === true;
}

function isTerminalSaveError(error: unknown): boolean {
  return (
    error instanceof InvalidSaveError ||
    error instanceof GoneSaveError ||
    error instanceof AuthExpiredError
  );
}

/** Replay any IndexedDB draft after the editor boots, rebasing onto `serverDoc`. */
export async function hydrateDraft(
  persister: Persister,
  serverDoc: EditorDoc,
): Promise<EditorDoc> {
  const row = await readDraftRow(serverDoc.siteId);
  if (!row) {
    persister.setDoc(serverDoc);
    persister.setRevision(serverDoc.revision);
    return serverDoc;
  }
  const rebased =
    Object.keys(row.pending).length > 0
      ? applyDraftToDoc(serverDoc, row.pending)
      : serverDoc;
  rebased.revision = serverDoc.revision;
  persister.setDoc(rebased);
  persister.setRevision(serverDoc.revision);
  if (Object.keys(row.pending).length > 0) {
    persister.queue(row.pending);
  }
  return rebased;
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
