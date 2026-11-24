"use server";

import { draftChangesSchema, type DraftChanges } from "@/editor/schema";
import { sanitizeChangesLinks } from "@/editor/links";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SITE_OWNER_SELECT } from "@/types/database";

export type SaveDraftResult =
  | { ok: true; revision: number }
  | {
      ok: false;
      code: "stale" | "auth" | "error";
      message?: string;
      revision?: number;
    };

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_changes";
    return { ok: false, code: "error", message };
  }

  const supabase = await createClient();
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select(SITE_OWNER_SELECT)
    .eq("id", args.siteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (siteError || !site) {
    return { ok: false, code: "auth", message: "site_gone" };
  }

  const { data: pageRows, error: pagesError } = await supabase
    .from("pages")
    .select("id")
    .eq("site_id", args.siteId);
  if (pagesError) {
    return { ok: false, code: "error", message: pagesError.message };
  }
  const pageIds = new Set((pageRows ?? []).map((row) => row.id));
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
