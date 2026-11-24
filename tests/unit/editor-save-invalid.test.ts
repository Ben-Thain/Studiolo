import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({ id: "5a000000-0000-4000-8000-000000000001" }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      throw new Error("database should not be touched");
    },
    rpc,
  }),
}));

describe("saveSiteDraft invalid content", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("returns invalid and stores nothing for a hostile text payload", async () => {
    const { saveSiteDraft } = await import("@/lib/editor/save");
    const result = await saveSiteDraft({
      siteId: "5a000000-0000-4000-8000-000000000011",
      expectedRevision: 1,
      changes: {
        elements: {
          upsert: [
            {
              id: "5a000000-0000-4000-8000-0000000000aa",
              page_id: "5a000000-0000-4000-8000-000000000021",
              section_id: "5a000000-0000-4000-8000-000000000032",
              type: "text",
              name: "Hostile",
              content: {
                text: "x",
                fontFamily: "Papyrus; background:url(...)",
                fontSize: 7,
                fontWeight: 900,
                align: "left",
                onclick: "alert(1)",
              },
              sort_order: 0,
            },
          ],
        },
      },
    });
    expect(result).toEqual({ ok: false, code: "invalid" });
    expect(JSON.stringify(result)).not.toMatch(/Papyrus/);
    expect(rpc).not.toHaveBeenCalled();
  });
});
