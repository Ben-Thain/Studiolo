import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyChanges } from "@/editor/changes";
import { createDoc } from "@/editor/doc";
import {
  StaleRevisionError,
  clearDraftRow,
  createPersister,
  draftKey,
  readDraftRow,
  writeDraftRow,
} from "@/editor/persist";

const SITE = "40000000-0000-4000-8000-000000000011";

afterEach(() => {
  vi.useRealTimers();
});

describe("persist", () => {
  it("debounces saves and advances revision on success", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => 3);
    const statuses: string[] = [];
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 2,
      doc: createDoc(SITE, 2),
      save,
      debounceMs: 200,
      onStatus: (state) => statuses.push(state.status),
    });
    persister.queue({
      elements: {
        upsert: [
          {
            id: "el",
            page_id: null,
            section_id: "s",
            type: "text",
            name: "T",
            content: {},
            sort_order: 0,
          },
        ],
      },
    });
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledWith({
      siteId: SITE,
      expectedRevision: 2,
      changes: expect.objectContaining({ elements: expect.any(Object) }),
    });
    expect(persister.getState().revision).toBe(3);
    expect(persister.getState().status).toBe("saved");
    expect(statuses).toContain("saving");
  });

  it("fires within max-wait even when debounce keeps resetting", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => 5);
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 1,
      doc: createDoc(SITE, 1),
      save,
      debounceMs: 800,
      maxWaitMs: 300,
    });
    for (let i = 0; i < 10; i += 1) {
      persister.queue(emptyChanges());
      await vi.advanceTimersByTimeAsync(50);
    }
    await vi.advanceTimersByTimeAsync(300);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalled();
  });

  it("merges back failed batches and saves queued edits during flight immediately after", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const save = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("server exploded");
      return 4;
    });
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 3,
      doc: createDoc(SITE, 3),
      save,
      debounceMs: 10,
    });
    persister.queue({
      pages: {
        upsert: [
          {
            id: "p",
            title: "First",
            slug: "first",
            sort_order: 0,
            in_nav: true,
            is_home: true,
          },
        ],
      },
    });
    await expect(persister.flush()).rejects.toThrow("server exploded");
    expect(persister.getState().pending.pages?.upsert?.[0]?.title).toBe(
      "First",
    );

    persister.queue({
      pages: {
        upsert: [
          {
            id: "p",
            title: "Second",
            slug: "second",
            sort_order: 0,
            in_nav: true,
            is_home: true,
          },
        ],
      },
    });
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(2);
    expect(persister.getState().revision).toBe(4);
  });

  it("surfaces ST409 as error", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockRejectedValue(new Error("stale_revision ST409"));
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 1,
      doc: createDoc(SITE, 1),
      save,
      debounceMs: 10,
    });
    persister.queue(emptyChanges());
    persister.queue({
      pages: {
        upsert: [
          {
            id: "p",
            title: "X",
            slug: "x",
            sort_order: 0,
            in_nav: true,
            is_home: true,
          },
        ],
      },
    });
    await expect(persister.flush()).rejects.toBeInstanceOf(StaleRevisionError);
    expect(persister.getState().status).toBe("error");
    expect(persister.getState().lastError).toBe("ST409");
  });

  it("writes pending doc+changes to IndexedDB when offline", async () => {
    const save = vi.fn().mockRejectedValue(new Error("network error"));
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 4,
      doc: createDoc(SITE, 4),
      save,
      debounceMs: 0,
      isOffline: () => true,
    });
    const changes = {
      sections: {
        upsert: [{ id: "s", page_id: null, name: "Header", sort_order: 0 }],
      },
    };
    persister.queue(changes);
    await persister.flush();
    expect(persister.getState().status).toBe("offline");
    const row = await readDraftRow(SITE);
    expect(row?.key).toBe(draftKey(SITE));
    expect(row?.baseRevision).toBe(4);
    expect(row?.pending).toEqual(changes);
    await clearDraftRow(SITE);
    await writeDraftRow({
      key: draftKey(SITE),
      siteId: SITE,
      baseRevision: 9,
      doc: createDoc(SITE, 9),
      pending: emptyChanges(),
    });
    expect(await readDraftRow(SITE)).toMatchObject({ baseRevision: 9 });
    await clearDraftRow(SITE);
  });
});
