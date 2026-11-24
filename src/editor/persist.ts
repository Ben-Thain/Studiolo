/**
 * Debounced save_draft persistence with offline queue (prompt 05).
 */

import { mergeChanges } from "./changes";
import type { DraftChanges } from "./schema";
import type { SaveStatus } from "./types";

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
const IDB_STORE = "pending-saves";

type PendingRow = {
  siteId: string;
  revision: number;
  changes: DraftChanges;
};

function hasIdb(): boolean {
  return typeof indexedDB !== "undefined";
}

async function openDb(): Promise<IDBDatabase | null> {
  if (!hasIdb()) return null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE, { keyPath: "siteId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readPendingSave(siteId: string): Promise<PendingRow | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(siteId);
    req.onsuccess = () => resolve((req.result as PendingRow | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function writePendingSave(row: PendingRow): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearPendingSave(siteId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(siteId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type CreatePersisterOptions = {
  siteId: string;
  initialRevision: number;
  save: SaveDraftFn;
  debounceMs?: number;
  onStatus?: (state: PersistState) => void;
};

export type Persister = {
  getState: () => PersistState;
  queue: (changes: DraftChanges) => void;
  flush: () => Promise<void>;
  setRevision: (revision: number) => void;
};

export function createPersister(options: CreatePersisterOptions): Persister {
  const debounceMs = options.debounceMs ?? 400;
  let state: PersistState = {
    status: "saved",
    revision: options.initialRevision,
    pending: {},
    queuedOffline: false,
    lastError: null,
  };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;

  const notify = () => options.onStatus?.(state);

  const setStatus = (status: SaveStatus, lastError: string | null = null) => {
    state = { ...state, status, lastError };
    notify();
  };

  const runSave = async () => {
    if (!Object.keys(state.pending).length) return;
    if (inFlight) {
      await inFlight;
      if (!Object.keys(state.pending).length) return;
    }
    const changes = state.pending;
    const expectedRevision = state.revision;
    setStatus("saving");
    const attempt = async () => {
      try {
        const nextRevision = await options.save({
          siteId: options.siteId,
          expectedRevision,
          changes,
        });
        state = {
          ...state,
          revision: nextRevision,
          pending: {},
          queuedOffline: false,
          lastError: null,
        };
        await clearPendingSave(options.siteId);
        setStatus("saved");
      } catch (error) {
        if (isStale(error)) {
          setStatus("error", "ST409");
          throw new StaleRevisionError();
        }
        if (isOffline(error)) {
          state = {
            ...state,
            queuedOffline: true,
          };
          await writePendingSave({
            siteId: options.siteId,
            revision: expectedRevision,
            changes,
          });
          setStatus("offline");
          return;
        }
        setStatus("error", error instanceof Error ? error.message : "save_failed");
        throw error;
      }
    };
    inFlight = attempt().finally(() => {
      inFlight = null;
    });
    await inFlight;
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void runSave();
    }, debounceMs);
  };

  return {
    getState: () => state,
    queue(changes) {
      state = {
        ...state,
        pending: mergeChanges(state.pending, changes),
      };
      notify();
      schedule();
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await runSave();
    },
    setRevision(revision) {
      state = { ...state, revision };
      notify();
    },
  };
}

function isStale(error: unknown): boolean {
  if (error instanceof StaleRevisionError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ST409") || message.includes("stale_revision");
}

function isOffline(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("network");
}

/** Replay any IndexedDB pending save after the editor boots. */
export async function hydratePendingSave(
  persister: Persister,
  siteId: string,
): Promise<void> {
  const row = await readPendingSave(siteId);
  if (!row) return;
  persister.setRevision(row.revision);
  persister.queue(row.changes);
}