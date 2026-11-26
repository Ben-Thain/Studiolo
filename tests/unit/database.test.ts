import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SITE_OWNER_SELECT_COLUMNS,
  SITE_OWNER_UPDATE_COLUMNS,
  SITE_ROW_KEYS,
  type Database,
} from "@/types/database";
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
    const added = readFileSync(
      path.join(root, "supabase/migrations/0010_templates.sql"),
      "utf8",
    )
      .split("\n")
      .map((line) => /^ {2}add column ([a-z_]+)/.exec(line)?.[1])
      .filter((name): name is string => Boolean(name));
    expect([...migrationSiteColumns(sql), ...added]).toEqual([...siteColumns]);
  });
});

function grantedSiteColumns(sql: string, privilege: string): string[] {
  const match = new RegExp(
    `grant ${privilege} \\(([^)]*)\\) on table public\\.sites to authenticated;`,
  ).exec(sql);
  if (!match?.[1]) {
    throw new Error(
      `grant ${privilege} on sites was not found in 0002_rls.sql`,
    );
  }
  return match[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

describe("sites owner column grants", () => {
  const sql = readFileSync(
    path.join(root, "supabase/migrations/0002_rls.sql"),
    "utf8",
  );

  it("lets the owner select every column except password_hash", () => {
    expect(SITE_OWNER_SELECT_COLUMNS).not.toContain("password_hash");
    const later = readFileSync(
      path.join(root, "supabase/migrations/0010_templates.sql"),
      "utf8",
    );
    expect([
      ...grantedSiteColumns(sql, "select"),
      ...grantedSiteColumns(later, "select"),
    ]).toEqual([...SITE_OWNER_SELECT_COLUMNS]);
  });

  it("limits owner updates to the editable columns", () => {
    expect(grantedSiteColumns(sql, "update")).toEqual([
      ...SITE_OWNER_UPDATE_COLUMNS,
    ]);
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
