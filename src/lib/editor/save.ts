"use server";

import { draftChangesSchema, type DraftChanges } from "@/editor/schema";
import { sanitizeChangesLinks } from "@/editor/links";
import { StaleRevisionError } from "@/editor/persist";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SITE_OWNER_SELECT } from "@/types/database";

/** Persist a draft revision through save_draft (owner-only). */
export async function saveSiteDraft(args: {
  siteId: string;
  expectedRevision: number;
  changes: DraftChanges;
  pageIds: string[];
}): Promise<number> {
  await requireUser();
  const parsed = draftChangesSchema.parse(args.changes);
  const pageIds = new Set(args.pageIds);
  const safe = sanitizeChangesLinks(parsed, pageIds);

  const supabase = await createClient();
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select(SITE_OWNER_SELECT)
    .eq("id", args.siteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (siteError || !site) throw new Error("Could not load this site.");

  const { data, error } = await supabase.rpc("save_draft", {
    site: args.siteId,
    expected_revision: args.expectedRevision,
    changes: safe as never,
  });

  if (error) {
    if (error.code === "ST409") throw new StaleRevisionError();
    throw new Error(error.message);
  }

  return Number(data);
}

export { StaleRevisionError };
