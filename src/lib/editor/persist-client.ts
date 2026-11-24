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
  saveErrorRetryDelayMs,
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
};

function browserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
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
    onStatus: (state) => store.set(state),
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
    window.addEventListener("online", () => {
      void persister.flush().catch(() => undefined);
    });
  }

  return {
    persister,
    status: store,
    queue: (changes) => {
      persister.queue(changes);
    },
    flush: () => persister.flush(),
    resumeAfterAuth: () => {
      sessionExpiredFired = false;
      return persister.flush();
    },
  };
}
