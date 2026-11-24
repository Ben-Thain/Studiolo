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

type SaveStatusStore = {
  get: () => PersistState;
  subscribe: (listener: () => void) => () => void;
};

const BACKOFF_SECONDS = [2, 5, 10, 30] as const;

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

/** Client wrapper: debounced save with 409 refetch, rebase and one retry. */
export function createEditorPersist(args: {
  siteId: string;
  doc: EditorDoc;
  onSessionExpired?: () => void;
}): EditorPersistHandle {
  let doc = args.doc;
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
      let attempt = 0;
      while (attempt < BACKOFF_SECONDS.length + 1) {
        try {
          return await persistSiteDraft({
            siteId,
            expectedRevision,
            changes,
            pageIds: doc.pages.map((p) => p.id),
          });
        } catch (error) {
          if (error instanceof StaleRevisionError) {
            doc = await fetchEditorDoc(siteId);
            persister.setDoc(doc);
            persister.setRevision(doc.revision);
            if (attempt === 0) {
              attempt += 1;
              continue;
            }
            throw error;
          }
          if (attempt >= BACKOFF_SECONDS.length) throw error;
          const delay = BACKOFF_SECONDS[attempt] * 1000;
          attempt += 1;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      throw new Error("save_exhausted");
    },
    isOffline: () =>
      typeof navigator !== "undefined" ? navigator.onLine === false : false,
  });

  return {
    persister,
    status: store,
    queue: (changes) => {
      if (!doc.pages.length) {
        args.onSessionExpired?.();
        return;
      }
      persister.queue(changes);
    },
    flush: () => persister.flush(),
  };
}
