import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyChanges } from "@/editor/changes";
import { createDoc } from "@/editor/doc";
import {
  StaleRevisionError,
  clearDraftRow,
  createPersister,
  draftKey,
  hydrateDraft,
  readDraftRow,
  writeDraftRow,
} from "@/editor/persist";

let siteCounter = 0;
function testSite() {
  siteCounter += 1;
  return `40000000-0000-4000-8000-${String(siteCounter).padStart(12, "0")}`;
}

let SITE = testSite();

afterEach(async () => {
  vi.useRealTimers();
  await clearDraftRow(SITE);
});

beforeEach(() => {
  SITE = testSite();
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
      maxWaitMs: 5000,
    });
    for (let t = 0; t < 8000; t += 300) {
      persister.queue(emptyChanges());
      await vi.advanceTimersByTimeAsync(300);
      if (t >= 4700 && save.mock.calls.length > 0) break;
    }
    expect(save).toHaveBeenCalled();
  });

  it("delivers edits queued mid-save to the server", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const save = vi.fn(
      async (payload: {
        changes: { pages?: { upsert?: { title: string }[] } };
      }) => {
        await gate;
        const title = payload.changes.pages?.upsert?.[0]?.title;
        return title === "Second" ? 6 : 5;
      },
    );
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 4,
      doc: createDoc(SITE, 4),
      save,
      debounceMs: 0,
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
    const flight = persister.flush();
    while (save.mock.calls.length === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
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
    release();
    await flight;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0].changes.pages?.upsert?.[0]?.title).toBe(
      "Second",
    );
    expect(persister.getState().revision).toBe(6);
  });

  it("merges back failed batches and saves queued edits during flight immediately after", async () => {
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
    await persister.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(persister.getState().revision).toBe(4);
  });

  it("keeps in-flight edits through a 409 and saves both afterwards", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const save = vi.fn(
      async (payload: {
        changes: { pages?: { upsert?: { id: string; title: string }[] } };
      }) => {
        calls += 1;
        await gate;
        const titles = (payload.changes.pages?.upsert ?? []).map(
          (row) => row.title,
        );
        if (calls === 1) throw new Error("stale_revision ST409");
        return titles.includes("second") && titles.includes("first") ? 7 : 6;
      },
    );
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 4,
      doc: createDoc(SITE, 4),
      save,
      debounceMs: 0,
    });
    persister.queue({
      pages: {
        upsert: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            title: "first",
            slug: "first",
            sort_order: 0,
            in_nav: true,
            is_home: true,
          },
        ],
      },
    });
    const flight = persister.flush();
    while (save.mock.calls.length === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
    persister.queue({
      pages: {
        upsert: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            title: "second",
            slug: "second",
            sort_order: 0,
            in_nav: true,
            is_home: true,
          },
        ],
      },
    });
    release();
    await expect(flight).rejects.toBeInstanceOf(StaleRevisionError);
    const pendingIds = (persister.getState().pending.pages?.upsert ?? []).map(
      (row) => row.id,
    );
    expect(pendingIds).toEqual(
      expect.arrayContaining([
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ]),
    );
    await persister.flush();
    expect(save).toHaveBeenCalledTimes(2);
    const secondIds = (save.mock.calls[1]?.[0].changes.pages?.upsert ?? []).map(
      (row: { id: string }) => row.id,
    );
    expect(secondIds).toEqual(
      expect.arrayContaining([
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ]),
    );
    expect(persister.getState().revision).toBe(7);
  });

  it("preserves newer offline edits when merging a failed batch", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(5);
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 3,
      doc: createDoc(SITE, 3),
      save,
      debounceMs: 0,
      isOffline: () => false,
    });
    persister.queue({
      pages: {
        upsert: [
          {
            id: "p",
            title: "old",
            slug: "old",
            sort_order: 0,
            in_nav: true,
            is_home: true,
          },
        ],
      },
    });
    await persister.flush();
    persister.queue({
      pages: {
        upsert: [
          {
            id: "p",
            title: "NEW",
            slug: "new",
            sort_order: 0,
            in_nav: true,
            is_home: true,
          },
        ],
      },
    });
    await persister.flush();
    expect(save.mock.calls.at(-1)?.[0].changes.pages?.upsert?.[0]?.title).toBe(
      "NEW",
    );
  });

  it("surfaces ST409 as error", async () => {
    const save = vi.fn().mockRejectedValue(new Error("stale_revision ST409"));
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 1,
      doc: createDoc(SITE, 1),
      save,
      debounceMs: 0,
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

  it("reload hydrates IndexedDB pending onto the server revision", async () => {
    const pending = {
      pages: {
        upsert: [
          {
            id: "p",
            title: "After crash",
            slug: "after",
            sort_order: 0,
            in_nav: true,
            is_home: true,
          },
        ],
      },
    };
    await writeDraftRow({
      key: draftKey(SITE),
      siteId: SITE,
      baseRevision: 2,
      doc: createDoc(SITE, 2),
      pending,
    });
    const save = vi.fn(async () => 3);
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 3,
      doc: createDoc(SITE, 3),
      save,
      debounceMs: 0,
    });
    const hydrated = await hydrateDraft(persister, createDoc(SITE, 3));
    expect(hydrated.pages[0]?.title).toBe("After crash");
    await persister.flush();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: 3,
        changes: pending,
      }),
    );
    await clearDraftRow(SITE);
  });

  it("keeps IndexedDB pending when a save succeeds during an in-flight queue", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let hangSecond!: () => void;
    const secondGate = new Promise<void>((resolve) => {
      hangSecond = resolve;
    });
    let saveCalls = 0;
    const save = vi.fn(async () => {
      saveCalls += 1;
      if (saveCalls === 1) {
        await gate;
        return 11;
      }
      await secondGate;
      return 12;
    });
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 10,
      doc: createDoc(SITE, 10),
      save,
      debounceMs: 0,
    });
    persister.queue({
      pages: {
        upsert: [
          {
            id: "p",
            title: "saved",
            slug: "saved",
            sort_order: 0,
            in_nav: true,
            is_home: true,
          },
        ],
      },
    });
    const flight = persister.flush();
    while (save.mock.calls.length === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
    persister.queue({
      pages: {
        upsert: [
          {
            id: "p",
            title: "after crash",
            slug: "after",
            sort_order: 0,
            in_nav: true,
            is_home: true,
          },
        ],
      },
    });
    release();
    while (saveCalls < 2) {
      await new Promise((r) => setTimeout(r, 0));
    }
    const row = await readDraftRow(SITE);
    expect(row?.pending.pages?.upsert?.[0]?.title).toBe("after crash");
    hangSecond();
    await flight;
    await clearDraftRow(SITE);
  });
});
