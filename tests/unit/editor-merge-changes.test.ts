import { describe, expect, it } from "vitest";
import { mergeChanges } from "@/editor/changes";

describe("mergeChanges", () => {
  it("drops an earlier delete when a later upsert revives the row", () => {
    const merged = mergeChanges(
      { elements: { delete: ["a"] } },
      {
        elements: {
          upsert: [
            {
              id: "a",
              page_id: null,
              section_id: "s",
              type: "text",
              name: "A",
              content: {},
              sort_order: 0,
            },
          ],
        },
      },
    );
    expect(merged.elements?.delete).toBeUndefined();
    expect(merged.elements?.upsert).toHaveLength(1);
  });

  it("drops an earlier upsert when a later delete removes the row", () => {
    const merged = mergeChanges(
      {
        elements: {
          upsert: [
            {
              id: "b",
              page_id: null,
              section_id: "s",
              type: "text",
              name: "B",
              content: {},
              sort_order: 0,
            },
          ],
        },
      },
      { elements: { delete: ["b"] } },
    );
    expect(merged.elements?.upsert).toBeUndefined();
    expect(merged.elements?.delete).toEqual(["b"]);
  });
});
