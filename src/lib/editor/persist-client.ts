"use client";

import type { DraftChanges } from "@/editor/schema";
import {
  StaleRevisionError,
  createPersister,
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

export const SAVE_ERROR_BACKOFF_SECONDS = [2, 5, 10, 30] as const;

export function saveErrorRetryDelayMs(
  errorAttempt: number,
  backoff: readonly number[] = SAVE_ERROR_BACKOFF_SECONDS,
): number {
  return (errorAttempt < backoff.length ? backoff[errorAttempt] : 30) * 1000;
}

const BACKOFF_SECONDS = SAVE_ERROR_BACKOFF_SECONDS;

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
};

export class AuthExpiredError extends Error {
  constructor() {
    super("session_expired");
    this.name = "AuthExpiredError";
  }
}

/** Client wrapper: debounced save with 409 refetch, rebase and one retry. */
export function createEditorPersist(args: {
  siteId: string;
  doc: EditorDoc;
  onSessionExpired?: () => void;
  /** Test hook: override error-retry delays (seconds). */
  retryBackoffSeconds?: readonly number[];
  saveDraft?: (input: {
    siteId: string;
    expectedRevision: number;
    changes: DraftChanges;
  }) => Promise<SaveDraftResult>;
  fetchDoc?: (siteId: string) => Promise<EditorDoc>;
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
      let errorAttempt = 0;
      while (true) {
        const result = await saveDraft({
          siteId,
          expectedRevision: revision,
          changes,
        });
        if (result.ok) return result.revision;

        if (result.code === "auth") {
          if (!sessionExpiredFired) {
            sessionExpiredFired = true;
            args.onSessionExpired?.();
          }
          throw new AuthExpiredError();
        }

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

        const delay = saveErrorRetryDelayMs(
          errorAttempt,
          args.retryBackoffSeconds ?? BACKOFF_SECONDS,
        );
        errorAttempt += 1;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    },
    isOffline: () =>
      typeof navigator !== "undefined" ? navigator.onLine === false : false,
  });

  return {
    persister,
    status: store,
    queue: (changes) => {
      persister.queue(changes);
    },
    flush: () => persister.flush(),
  };
}
