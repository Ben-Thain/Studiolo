import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

const ROOT = path.resolve(import.meta.dirname, "../..");

function parseSeedLayouts() {
  const sql = readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8");
  const match = sql.match(
    /'5a000000-0000-4000-8000-000000000103'.*?'mobile', 1, 12, (\d+), (\d+)/,
  );
  expect(match).toBeTruthy();
  return { row: Number(match![1]), rows: Number(match![2]) };
}

describe("riverton fixture", () => {
  it("matches seed hero mobile stack and caption rows", () => {
    const seed = parseSeedLayouts();
    const hero = rivertonHomeDoc.elements.find((e) => e.name === "Hero image")!;
    const mobile = rivertonHomeDoc.layouts.find(
      (l) => l.elementId === hero.id && l.breakpoint === "mobile",
    )!;
    expect(mobile.row).toBe(seed.row);
    expect(mobile.rows).toBe(seed.rows);

    const captions = ["Clifton caption", "Bootham caption", "Heworth caption"];
    for (const name of captions) {
      const el = rivertonHomeDoc.elements.find((e) => e.name === name);
      expect(el).toBeTruthy();
    }
  });
});
