"use server";

import { draftChangesSchema, type DraftChanges } from "@/editor/schema";
import { sanitizeChangesLinks } from "@/editor/links";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SITE_OWNER_SELECT } from "@/types/database";

export type SaveDraftCode = "stale" | "auth" | "gone" | "invalid" | "error";

export type SaveDraftResult =
  | { ok: true; revision: number }
  | {
      ok: false;
      code: SaveDraftCode;
      message?: string;
      revision?: number;
    };

/** Page ids a link may target: rows already stored, plus pages in this payload. */
export function allowedPageIds(
  storedIds: Iterable<string>,
  changes: {
    pages?: { upsert?: { id: string }[]; delete?: string[] };
  },
): Set<string> {
  const ids = new Set(storedIds);
  for (const id of changes.pages?.delete ?? []) ids.delete(id);
  for (const row of changes.pages?.upsert ?? []) ids.add(row.id);
  return ids;
}

/** Persist a draft revision through save_draft (owner-only). */
export async function saveSiteDraft(args: {
  siteId: string;
  expectedRevision: number;
  changes: DraftChanges;
}): Promise<SaveDraftResult> {
  try {
    await requireUser();
  } catch {
    return { ok: false, code: "auth", message: "session_expired" };
  }

  let parsed: DraftChanges;
  try {
    parsed = draftChangesSchema.parse(args.changes);
  } catch {
    return { ok: false, code: "invalid" };
  }

  const supabase = await createClient();
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select(SITE_OWNER_SELECT)
    .eq("id", args.siteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (siteError || !site) {
    return { ok: false, code: "gone" };
  }

  const { data: pageRows, error: pagesError } = await supabase
    .from("pages")
    .select("id")
    .eq("site_id", args.siteId);
  if (pagesError) {
    return { ok: false, code: "error", message: pagesError.message };
  }
  const pageIds = allowedPageIds(
    (pageRows ?? []).map((row) => row.id),
    parsed,
  );
  const safe = sanitizeChangesLinks(parsed, pageIds);

  const { data, error } = await supabase.rpc("save_draft", {
    site: args.siteId,
    expected_revision: args.expectedRevision,
    changes: safe as never,
  });

  if (error) {
    if (error.code === "ST409") {
      return { ok: false, code: "stale", message: "stale_revision" };
    }
    return { ok: false, code: "error", message: error.message };
  }

  return { ok: true, revision: Number(data) };
}
