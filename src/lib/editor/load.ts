import "server-only";

import {
  createDoc,
  elementFromRow,
  layoutFromRow,
  pageFromRow,
  sectionFromRow,
} from "@/editor/doc";
import type { EditorDoc, EditorAsset, ElementType } from "@/editor/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SITE_OWNER_SELECT } from "@/types/database";

type LayoutRow = {
  id: string;
  element_id: string;
  breakpoint: "desktop" | "mobile";
  col_start: number;
  col_span: number;
  row_start: number;
  row_span: number;
  hidden: boolean;
  placement_source: "auto" | "manual";
};

/** Fetch an EditorDoc for one site after verifying ownership. */
export async function loadEditorDoc(siteId: string): Promise<EditorDoc> {
  const supabase = await createClient();

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select(SITE_OWNER_SELECT)
    .eq("id", siteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (siteError || !site) {
    throw new Error("Could not load this site.");
  }

  const [pages, sections, elementRows, assets] = await Promise.all([
    supabase
      .from("pages")
      .select("id, title, slug, sort_order, in_nav, is_home")
      .eq("site_id", siteId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("sections")
      .select("id, page_id, name, sort_order")
      .eq("site_id", siteId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("elements")
      .select(
        "id, page_id, section_id, type, name, content, sort_order, element_layouts (id, element_id, breakpoint, col_start, col_span, row_start, row_span, hidden, placement_source)",
      )
      .eq("site_id", siteId)
      .order("sort_order", { ascending: true }),
    supabase.from("assets").select("id, path, mime").eq("site_id", siteId),
  ]);

  if (pages.error || sections.error || elementRows.error) {
    throw new Error("Could not load this site.");
  }

  const revision =
    "draft_revision" in site && typeof site.draft_revision === "number"
      ? site.draft_revision
      : 0;
  const doc = createDoc(siteId, revision);
  doc.pages = pages.data.map(pageFromRow);
  doc.sections = sections.data.map(sectionFromRow);
  doc.elements = elementRows.data.map((row) =>
    elementFromRow({
      id: row.id,
      page_id: row.page_id,
      section_id: row.section_id,
      type: row.type as ElementType,
      name: row.name,
      content: row.content as Record<string, unknown>,
      sort_order: row.sort_order,
    }),
  );

  const layoutRows: LayoutRow[] = [];
  for (const row of elementRows.data) {
    for (const layout of row.element_layouts ?? []) {
      layoutRows.push(layout as LayoutRow);
    }
  }
  doc.layouts = layoutRows.map(layoutFromRow);

  if (assets.data?.length) {
    const admin = createAdminClient();
    const expiresIn = 3600;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    const paths = assets.data.map((row) => row.path);
    const signed = await admin.storage
      .from("site-assets")
      .createSignedUrls(paths, expiresIn);
    const byPath = new Map(
      (signed.data ?? []).map((item) => [item.path, item.signedUrl]),
    );
    const record: Record<string, EditorAsset> = {};
    for (const row of assets.data) {
      const readUrl = byPath.get(row.path) ?? undefined;
      record[row.id] = {
        path: row.path,
        mime: row.mime ?? undefined,
        readUrl,
        readUrlExpiresAt: readUrl ? expiresAt : undefined,
      };
    }
    doc.assets = record;
  }

  return doc;
}

/** Touch layout_seen_at when an editor session opens the canvas. */
export async function markLayoutSeen(
  siteId: string,
  breakpoint: "desktop" | "mobile",
): Promise<void> {
  const supabase = await createClient();
  const seenAt = new Date().toISOString();
  const { error } =
    breakpoint === "desktop"
      ? await supabase
          .from("sites")
          .update({ desktop_layout_seen_at: seenAt })
          .eq("id", siteId)
      : await supabase
          .from("sites")
          .update({ mobile_layout_seen_at: seenAt })
          .eq("id", siteId);
  if (error) throw new Error("Could not update layout seen.");
}
