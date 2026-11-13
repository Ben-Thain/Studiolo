import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SITE_ROW_KEYS, type Database } from "@/types/database";
import { siteColumns } from "../fixtures/site-columns";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

type SiteRow = Database["public"]["Tables"]["sites"]["Row"];
type Listed = (typeof SITE_ROW_KEYS)[number];
type Missing = Exclude<keyof SiteRow, Listed>;
type Extra = Exclude<Listed, keyof SiteRow>;
type AssertNever<T extends never> = T;
type _SiteKeysMatch = AssertNever<Missing | Extra>;

function migrationSiteColumns(sql: string): string[] {
  const match = sql.match(/create table public\.sites \(([\s\S]*?)\n\);/);
  if (!match?.[1]) {
    throw new Error("sites table was not found in 0001_core.sql");
  }
  return match[1]
    .split("\n")
    .map((line) => /^ {2}([a-z_]+) /.exec(line))
    .flatMap((found) => {
      const name = found?.[1];
      return name && name !== "constraint" ? [name] : [];
    });
}

describe("sites database types", () => {
  it("matches the migration columns and the fixture", () => {
    const keysMatch: _SiteKeysMatch extends never ? true : false = true;
    expect(keysMatch).toBe(true);
    expect([...SITE_ROW_KEYS]).toEqual([...siteColumns]);

    const sql = readFileSync(
      path.join(root, "supabase/migrations/0001_core.sql"),
      "utf8",
    );
    expect(migrationSiteColumns(sql)).toEqual([...siteColumns]);
  });
});

describe("admin supabase client", () => {
  it("starts with server-only and reads the service role through env.server", () => {
    const source = readFileSync(
      path.join(root, "src/lib/supabase/admin.ts"),
      "utf8",
    );
    const [firstLine] = source.split("\n");
    expect(firstLine).toMatch(/^import ["']server-only["'];$/);
    expect(source).toContain('from "@/lib/env.server"');
    expect(source).not.toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    expect(source).toContain("serverEnv.SUPABASE_SERVICE_ROLE_KEY");
  });
});
