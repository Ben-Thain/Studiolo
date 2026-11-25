import pg from "pg";
import { describe, expect, it } from "vitest";
import { allowedPageIds } from "@/editor/page-ids";
import { sanitizeChangesLinks } from "@/editor/links";
import type { DraftChanges } from "@/editor/schema";

const SITE = "5a000000-0000-4000-8000-00000000ab11";
const OTHER_PAGE = "5a000000-0000-4000-8000-000000000026";
const SECTION = "5a000000-0000-4000-8000-000000000032";
const HOME = "5a000000-0000-4000-8000-00000000ab21";
const NEW_PAGE = "5a000000-0000-4000-8000-00000000aa01";
const NEW_ELEMENT = "5a000000-0000-4000-8000-00000000aa02";
const FOREIGN_ELEMENT = "5a000000-0000-4000-8000-00000000aa03";

function textElement(
  id: string,
  pageId: string,
  linkPage: string,
): NonNullable<DraftChanges["elements"]>["upsert"] {
  return [
    {
      id,
      page_id: pageId,
      section_id: SECTION,
      type: "text",
      name: "Linked",
      content: {
        text: "See the new page",
        fontFamily: "Inter",
        fontSize: 18,
        fontWeight: 400,
        align: "left",
        link: { kind: "page", value: linkPage },
      },
      sort_order: 9,
    },
  ];
}

describe("same-save page links", () => {
  it("keeps a link to a page created in the same save and drops another site", async () => {
    const client = new pg.Client({
      host: process.env.PGHOST ?? "/var/run/postgresql",
      database: "studiolo_check",
      user: process.env.PGUSER ?? process.env.USER ?? "ubuntu",
    });
    await client.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into auth.users (id, email) values ($1, 'link-save@example.com')`,
        ["5a000000-0000-4000-8000-00000000ab01"],
      );
      await client.query(
        `insert into public.sites (id, owner_id, name, slug) values ($1, $2, 'Link', 'link-save')`,
        [SITE, "5a000000-0000-4000-8000-00000000ab01"],
      );
      await client.query(
        `insert into public.pages (id, site_id, title, slug, sort_order, in_nav, is_home)
         values ($1, $2, 'Home', '', 0, true, true)`,
        [HOME, SITE],
      );
      await client.query(
        `insert into public.sections (id, site_id, page_id, name, sort_order)
         values ($1, $2, $3, 'Intro', 1)`,
        [SECTION, SITE, HOME],
      );
      const stored = await client.query<{ id: string }>(
        "select id from public.pages where site_id = $1",
        [SITE],
      );
      const revision = await client.query<{ draft_revision: number }>(
        "select draft_revision from public.sites where id = $1",
        [SITE],
      );
      const changes: DraftChanges = {
        pages: {
          upsert: [
            {
              id: NEW_PAGE,
              title: "New",
              slug: "new-page",
              sort_order: 9,
              in_nav: false,
              is_home: false,
            },
          ],
        },
        elements: {
          upsert: [
            ...textElement(NEW_ELEMENT, HOME, NEW_PAGE)!,
            ...textElement(FOREIGN_ELEMENT, HOME, OTHER_PAGE)!,
          ],
        },
      };
      const allowed = allowedPageIds(
        stored.rows.map((row) => row.id),
        changes,
      );
      expect(stored.rows.map((row) => row.id)).not.toContain(NEW_PAGE);
      const safe = sanitizeChangesLinks(changes, allowed);
      const kept = safe.elements?.upsert?.find((row) => row.id === NEW_ELEMENT);
      const dropped = safe.elements?.upsert?.find(
        (row) => row.id === FOREIGN_ELEMENT,
      );
      expect(kept?.content.link).toEqual({ kind: "page", value: NEW_PAGE });
      expect(dropped?.content.link).toBeUndefined();
      await client.query("select public.save_draft($1, $2, $3::jsonb)", [
        SITE,
        revision.rows[0]?.draft_revision ?? 0,
        JSON.stringify(safe),
      ]);
      const row = await client.query<{ content: { link?: { value: string } } }>(
        "select content from public.elements where id = $1",
        [NEW_ELEMENT],
      );
      expect(row.rows[0]?.content.link?.value).toBe(NEW_PAGE);
      const foreign = await client.query<{ content: { link?: unknown } }>(
        "select content from public.elements where id = $1",
        [FOREIGN_ELEMENT],
      );
      expect(foreign.rows[0]?.content.link).toBeUndefined();
    } finally {
      await client.query("rollback");
      await client.end();
    }
  });
});
