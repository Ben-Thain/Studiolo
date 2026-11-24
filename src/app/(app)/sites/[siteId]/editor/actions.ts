"use server";

import { loadEditorDoc, markLayoutSeen } from "@/lib/editor/load";
import { saveSiteDraft } from "@/lib/editor/save";
import type { DraftChanges } from "@/editor/schema";

export async function fetchEditorDoc(siteId: string) {
  return loadEditorDoc(siteId);
}

export async function persistSiteDraft(args: {
  siteId: string;
  expectedRevision: number;
  changes: DraftChanges;
}) {
  return saveSiteDraft(args);
}

export async function touchLayoutSeen(
  siteId: string,
  breakpoint: "desktop" | "mobile",
) {
  await markLayoutSeen(siteId, breakpoint);
}
