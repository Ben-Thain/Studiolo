import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyChanges } from "@/editor/changes";
import {
  StaleRevisionError,
  clearPendingSave,
  createPersister,
  readPendingSave,
  writePendingSave,
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
      save,
      debounceMs: 200,
      onStatus: (state) => statuses.push(state.status),
    });
    persister.queue({
      elements: { upsert: [{ id: "el", page_id: null, section_id: "s", type: "text", name: "T", content: {}, sort_order: 0 }] },
    });
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(save).toHaveBeenCalledWith({
      siteId: SITE,
      expectedRevision: 2,
      changes: expect.objectContaining({ elements: expect.any(Object) }),
    });
    expect(persister.getState().revision).toBe(3);
    expect(persister.getState().status).toBe("saved");
    expect(statuses).toContain("saving");
  });

  it("surfaces ST409 as error", async () => {
    vi.useFakeTimers();
    const save = vi
      .fn()
      .mockRejectedValue(new Error("stale_revision ST409"));
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 1,
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

  it("writes pending changes to IndexedDB when offline", async () => {
    if (typeof indexedDB === "undefined") return;
    const save = vi.fn().mockRejectedValue(new Error("network error"));
    Object.defineProperty(globalThis.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const persister = createPersister({
      siteId: SITE,
      initialRevision: 4,
      save,
      debounceMs: 0,
    });
    const changes = {
      sections: {
        upsert: [
          { id: "s", page_id: null, name: "Header", sort_order: 0 },
        ],
      },
    };
    persister.queue(changes);
    await persister.flush();
    expect(persister.getState().status).toBe("offline");
    const row = await readPendingSave(SITE);
    expect(row?.revision).toBe(4);
    expect(row?.changes).toEqual(changes);
    await clearPendingSave(SITE);
    await writePendingSave({
      siteId: SITE,
      revision: 9,
      changes: emptyChanges(),
    });
    expect(await readPendingSave(SITE)).toMatchObject({ revision: 9 });
    await clearPendingSave(SITE);
    Object.defineProperty(globalThis.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });
});