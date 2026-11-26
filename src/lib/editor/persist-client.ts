"use client";

import type { DraftChanges } from "@/editor/schema";
import {
  AuthExpiredError,
  GoneSaveError,
  InvalidSaveError,
  OfflineSaveError,
  RetryableSaveError,
  SAVE_ERROR_BACKOFF_SECONDS,
  StaleRevisionError,
  createPersister,
  draftKey,
  saveErrorRetryDelayMs,
  writeDraftRow,
  type DraftRow,
  type Persister,
  type PersistState,
} from "@/editor/persist";
import type { EditorDoc } from "@/editor/types";
import {
  fetchEditorDoc,
  persistSiteDraft,
} from "@/app/(app)/sites/[siteId]/editor/actions";
import type { SaveDraftResult } from "@/lib/editor/save";

type SaveStatusStore = {
  get: () => PersistState;
  subscribe: (listener: () => void) => () => void;
};

export { AuthExpiredError, SAVE_ERROR_BACKOFF_SECONDS, saveErrorRetryDelayMs };

function createStatusStore(initial: PersistState): SaveStatusStore & {
  set: (s: PersistState) => void;
} {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      state = next;
      for (const listener of listeners) listener();
    },
  };
}

export type EditorPersistHandle = {
  persister: Persister;
  status: SaveStatusStore;
  queue: (changes: DraftChanges) => void;
  flush: () => Promise<void>;
  /** Clear the one-shot auth notice and try the pending save again. */
  resumeAfterAuth: () => Promise<void>;
  dispose: () => void;
};

/** True when a fetch or server-action response looks like an auth redirect or login page. */
export function detectAuthResponse(response: Response): boolean {
  if (response.status === 401 || response.status === 403) return true;
  const location = response.headers.get("location") ?? "";
  if (
    response.status >= 300 &&
    response.status < 400 &&
    location.includes("/login")
  ) {
    return true;
  }
  const type = response.headers.get("content-type") ?? "";
  if (response.status === 200 && type.includes("text/html")) {
    return true;
  }
  return false;
}

function browserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function crashDraftKey(siteId: string): string {
  return `studiolo:crash-draft:${siteId}`;
}

/** Synchronous copy of the pending draft. IndexedDB can lose a write if the tab closes first. */
function writeCrashDraft(siteId: string, row: DraftRow): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(crashDraftKey(siteId), JSON.stringify(row));
}

function clearCrashDraft(siteId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(crashDraftKey(siteId));
}

/** Copy a crash draft into IndexedDB so hydrateDraft can replay it. */
export async function restoreCrashDraft(siteId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(crashDraftKey(siteId));
  if (!raw) return;
  const row = JSON.parse(raw) as DraftRow;
  await writeDraftRow({ ...row, key: draftKey(siteId), siteId });
}

/** Client wrapper: debounced save, stale rebase, and persister-owned backoff. */
export function createEditorPersist(args: {
  siteId: string;
  doc: EditorDoc;
  onSessionExpired?: () => void;
  saveDraft?: (input: {
    siteId: string;
    expectedRevision: number;
    changes: DraftChanges;
  }) => Promise<SaveDraftResult>;
  fetchDoc?: (siteId: string) => Promise<EditorDoc>;
  draftStore?: {
    write: (row: import("@/editor/persist").DraftRow) => Promise<void>;
    clear: (siteId: string) => Promise<void>;
  };
}): EditorPersistHandle {
  let doc = args.doc;
  let sessionExpiredFired = false;
  let onlineHandler: (() => void) | null = null;
  const saveDraft = args.saveDraft ?? persistSiteDraft;
  const fetchDoc = args.fetchDoc ?? fetchEditorDoc;

  const store = createStatusStore({
    status: "saved",
    revision: doc.revision,
    pending: {},
    queuedOffline: false,
    lastError: null,
  });

  const persister = createPersister({
    siteId: args.siteId,
    initialRevision: doc.revision,
    doc,
    debounceMs: 800,
    maxWaitMs: 5000,
    onStatus: (state) => {
      store.set(state);
      if (state.status === "saved" && !Object.keys(state.pending).length) {
        clearCrashDraft(args.siteId);
      }
    },
    save: async ({ siteId, expectedRevision, changes }) => {
      let revision = expectedRevision;
      let staleRetries = 0;
      while (true) {
        let result: SaveDraftResult;
        try {
          result = await saveDraft({
            siteId,
            expectedRevision: revision,
            changes,
          });
        } catch (error) {
          if (
            typeof Response !== "undefined" &&
            error instanceof Response &&
            detectAuthResponse(error)
          ) {
            throw new AuthExpiredError();
          }
          if (browserOffline()) throw new OfflineSaveError();
          throw new RetryableSaveError(
            error instanceof Error ? error.message : "save_failed",
          );
        }
        if (result.ok) {
          sessionExpiredFired = false;
          return result.revision;
        }

        if (result.code === "auth") {
          if (!sessionExpiredFired) {
            sessionExpiredFired = true;
            args.onSessionExpired?.();
          }
          throw new AuthExpiredError();
        }

        if (result.code === "gone") throw new GoneSaveError();
        if (result.code === "invalid") throw new InvalidSaveError();

        if (result.code === "stale") {
          if (staleRetries === 0) {
            doc = await fetchDoc(siteId);
            persister.setDoc(doc);
            revision = doc.revision;
            persister.setRevision(revision);
            staleRetries += 1;
            continue;
          }
          throw new StaleRevisionError();
        }

        throw new RetryableSaveError(result.message ?? "save_failed");
      }
    },
    isOffline: () => browserOffline(),
    draftStore: args.draftStore,
  });

  if (typeof window !== "undefined") {
    onlineHandler = () => {
      void persister.flush().catch(() => undefined);
    };
    window.addEventListener("online", onlineHandler);
  }

  return {
    persister,
    status: store,
    queue: (changes) => {
      persister.queue(changes);
      const state = persister.getState();
      writeCrashDraft(args.siteId, {
        key: draftKey(args.siteId),
        siteId: args.siteId,
        baseRevision: state.revision,
        doc: persister.getDoc(),
        pending: state.pending,
      });
    },
    flush: () => persister.flush(),
    resumeAfterAuth: () => {
      sessionExpiredFired = false;
      return persister.flush();
    },
    dispose: () => {
      persister.dispose();
      if (typeof window !== "undefined" && onlineHandler) {
        window.removeEventListener("online", onlineHandler);
        onlineHandler = null;
      }
    },
  };
}
