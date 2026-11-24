import { afterEach, describe, expect, it, vi } from "vitest";
import { createDoc } from "@/editor/doc";
import {
  AuthExpiredError,
  SAVE_ERROR_BACKOFF_SECONDS,
  createEditorPersist,
  saveErrorRetryDelayMs,
} from "@/lib/editor/persist-client";
import type { SaveDraftResult } from "@/lib/editor/save";

let siteCounter = 0;
function testSite() {
  siteCounter += 1;
  return `40000000-0000-4000-8000-${String(siteCounter).padStart(12, "0")}`;
}

afterEach(() => {
  vi.useRealTimers();
});

const pageChange = {
  pages: {
    upsert: [
      {
        id: "p",
        title: "Save",
        slug: "save",
        sort_order: 0,
        in_nav: true,
        is_home: true,
      },
    ],
  },
};

describe("createEditorPersist save", () => {
  it("refetches and retries with the new revision after a stale result", async () => {
    const SITE = testSite();
    const saveDraft = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        code: "stale",
      } satisfies SaveDraftResult)
      .mockResolvedValueOnce({
        ok: true,
        revision: 9,
      } satisfies SaveDraftResult);
    const fetchDoc = vi.fn(async () => ({
      ...createDoc(SITE, 8),
      pages: [
        {
          id: "p",
          title: "Home",
          slug: "home",
          sortOrder: 0,
          inNav: true,
          isHome: true,
        },
      ],
    }));
    const handle = createEditorPersist({
      siteId: SITE,
      doc: createDoc(SITE, 7),
      saveDraft,
      fetchDoc,
    });
    handle.queue(pageChange);
    await handle.flush();
    expect(fetchDoc).toHaveBeenCalledWith(SITE);
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft.mock.calls[1]?.[0].expectedRevision).toBe(8);
    expect(handle.persister.getState().revision).toBe(9);
  });

  it("keeps retrying through ten errors using the spec backoff gaps", async () => {
    const SITE = testSite();
    let attempts = 0;
    const saveDraft = vi.fn(async (): Promise<SaveDraftResult> => {
      attempts += 1;
      if (attempts >= 10) return { ok: true, revision: 2 };
      return { ok: false, code: "error", message: "boom" };
    });
    const handle = createEditorPersist({
      siteId: SITE,
      doc: createDoc(SITE, 1),
      saveDraft,
      retryBackoffSeconds: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    handle.queue(pageChange);
    await handle.flush();
    expect(saveDraft).toHaveBeenCalledTimes(10);
  });

  it("waits the spec backoff gaps between error retries", () => {
    expect(SAVE_ERROR_BACKOFF_SECONDS).toEqual([2, 5, 10, 30]);
    expect(saveErrorRetryDelayMs(0)).toBe(2000);
    expect(saveErrorRetryDelayMs(1)).toBe(5000);
    expect(saveErrorRetryDelayMs(2)).toBe(10000);
    expect(saveErrorRetryDelayMs(3)).toBe(30000);
    expect(saveErrorRetryDelayMs(99)).toBe(30000);
  });

  it("calls onSessionExpired exactly once for auth", async () => {
    const SITE = testSite();
    const onSessionExpired = vi.fn();
    const saveDraft = vi.fn().mockResolvedValue({
      ok: false,
      code: "auth",
    } satisfies SaveDraftResult);
    const handle = createEditorPersist({
      siteId: SITE,
      doc: createDoc(SITE, 2),
      onSessionExpired,
      saveDraft,
    });
    handle.queue(pageChange);
    await expect(handle.flush()).rejects.toBeInstanceOf(AuthExpiredError);
    handle.queue(pageChange);
    await expect(handle.flush()).rejects.toBeInstanceOf(AuthExpiredError);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });
});
