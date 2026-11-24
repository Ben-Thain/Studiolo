import { afterEach, describe, expect, it, vi } from "vitest";
import { createDoc } from "@/editor/doc";
import { GoneSaveError, InvalidSaveError } from "@/editor/persist";
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

const memoryDraft = {
  write: async () => undefined,
  clear: async () => undefined,
};

const pageChange = {
  pages: {
    upsert: [
      {
        id: "5a000000-0000-4000-8000-000000000099",
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
          id: "5a000000-0000-4000-8000-000000000099",
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
      draftStore: memoryDraft,
    });
    handle.queue(pageChange);
    await handle.flush();
    expect(fetchDoc).toHaveBeenCalledWith(SITE);
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft.mock.calls[1]?.[0].expectedRevision).toBe(8);
    expect(handle.persister.getState().revision).toBe(9);
  });

  it("retries a thrown fetch on the spec backoff and ends saved", async () => {
    vi.useFakeTimers();
    const SITE = testSite();
    let attempts = 0;
    const saveDraft = vi.fn(async (): Promise<SaveDraftResult> => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      return { ok: true, revision: 4 };
    });
    const handle = createEditorPersist({
      siteId: SITE,
      doc: createDoc(SITE, 1),
      saveDraft,
      draftStore: memoryDraft,
    });
    handle.queue(pageChange);
    const flight = handle.flush();
    await expect(flight).rejects.toThrow(/Failed to fetch/);
    expect(handle.persister.getState().status).toBe("error");
    await vi.advanceTimersByTimeAsync(2000);
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(handle.persister.getState().status).toBe("saved");
  });

  it("keeps retrying through ten errors using the spec backoff gaps", async () => {
    vi.useFakeTimers();
    const SITE = testSite();
    const marks: number[] = [];
    const saveDraft = vi.fn(async (): Promise<SaveDraftResult> => {
      marks.push(Date.now());
      if (marks.length <= 10) return { ok: false, code: "error" };
      return { ok: true, revision: 6 };
    });
    const handle = createEditorPersist({
      siteId: SITE,
      doc: createDoc(SITE, 1),
      saveDraft,
      draftStore: memoryDraft,
    });
    handle.queue(pageChange);
    const flight = handle.flush();
    await expect(flight).rejects.toBeTruthy();
    expect(handle.persister.getState().status).toBe("error");
    const gaps = [
      2000, 5000, 10000, 30000, 30000, 30000, 30000, 30000, 30000, 30000,
    ];
    for (const gap of gaps) {
      await vi.advanceTimersByTimeAsync(gap);
    }
    const start = marks[0] ?? 0;
    expect(marks.slice(0, 6).map((mark) => mark - start)).toEqual([
      0, 2000, 7000, 17000, 47000, 77000,
    ]);
    expect(saveDraft.mock.calls.length).toBeGreaterThanOrEqual(10);
    expect(handle.persister.getState().status).toBe("saved");
  });

  it("waits the spec backoff gaps between error retries", () => {
    expect(SAVE_ERROR_BACKOFF_SECONDS).toEqual([2, 5, 10, 30]);
    expect(saveErrorRetryDelayMs(0)).toBe(2000);
    expect(saveErrorRetryDelayMs(1)).toBe(5000);
    expect(saveErrorRetryDelayMs(2)).toBe(10000);
    expect(saveErrorRetryDelayMs(3)).toBe(30000);
    expect(saveErrorRetryDelayMs(99)).toBe(30000);
  });

  it("calls onSessionExpired exactly once for auth until a later success", async () => {
    const SITE = testSite();
    const onSessionExpired = vi.fn();
    const saveDraft = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        code: "auth",
      } satisfies SaveDraftResult)
      .mockResolvedValueOnce({
        ok: false,
        code: "auth",
      } satisfies SaveDraftResult)
      .mockResolvedValueOnce({
        ok: true,
        revision: 3,
      } satisfies SaveDraftResult)
      .mockResolvedValueOnce({
        ok: false,
        code: "auth",
      } satisfies SaveDraftResult);
    const handle = createEditorPersist({
      siteId: SITE,
      doc: createDoc(SITE, 2),
      onSessionExpired,
      saveDraft,
      draftStore: memoryDraft,
    });
    handle.queue(pageChange);
    await expect(handle.flush()).rejects.toBeInstanceOf(AuthExpiredError);
    await expect(handle.flush()).rejects.toBeInstanceOf(AuthExpiredError);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    await handle.resumeAfterAuth();
    expect(handle.persister.getState().status).toBe("saved");
    handle.queue(pageChange);
    await expect(handle.flush()).rejects.toBeInstanceOf(AuthExpiredError);
    expect(onSessionExpired).toHaveBeenCalledTimes(2);
  });

  it("does not re-auth or retry a gone site", async () => {
    const SITE = testSite();
    const onSessionExpired = vi.fn();
    const saveDraft = vi.fn().mockResolvedValue({
      ok: false,
      code: "gone",
    } satisfies SaveDraftResult);
    const handle = createEditorPersist({
      siteId: SITE,
      doc: createDoc(SITE, 2),
      onSessionExpired,
      saveDraft,
      draftStore: memoryDraft,
    });
    handle.queue(pageChange);
    await expect(handle.flush()).rejects.toBeInstanceOf(GoneSaveError);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(handle.persister.getState().pending.pages?.upsert).toHaveLength(1);
  });

  it("does not retry invalid changes or surface a parser message", async () => {
    const SITE = testSite();
    const saveDraft = vi.fn().mockResolvedValue({
      ok: false,
      code: "invalid",
    } satisfies SaveDraftResult);
    const handle = createEditorPersist({
      siteId: SITE,
      doc: createDoc(SITE, 2),
      saveDraft,
      draftStore: memoryDraft,
    });
    handle.queue(pageChange);
    await expect(handle.flush()).rejects.toBeInstanceOf(InvalidSaveError);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(handle.persister.getState().lastError).toBe("invalid_changes");
    expect(handle.persister.getState().pending.pages?.upsert).toHaveLength(1);
  });
});
