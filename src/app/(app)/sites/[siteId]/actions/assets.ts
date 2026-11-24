"use server";

import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "site-assets";

export type AssetUploadTicket =
  | {
      ok: true;
      assetId: string;
      path: string;
      token: string;
      signedUrl: string;
    }
  | { ok: false; error: string };

export type AssetConfirmResult =
  { ok: true; path: string; readUrl: string } | { ok: false; error: string };

async function ownedSite(siteId: string) {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

/** Create the assets row and a signed upload URL for the draft WebP. */
export async function createAssetUpload(
  siteId: string,
): Promise<AssetUploadTicket> {
  const site = await ownedSite(siteId);
  if (!site) return { ok: false, error: "This site is not available." };
  const admin = createAdminClient();
  const assetId = crypto.randomUUID();
  const path = `${siteId}/draft/${assetId}.webp`;
  const { error: insertError } = await admin.from("assets").insert({
    id: assetId,
    site_id: siteId,
    path,
    mime: "image/webp",
    bytes: 0,
  });
  if (insertError) return { ok: false, error: "Could not start the upload." };
  const signed = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) {
    return { ok: false, error: "Could not start the upload." };
  }
  return {
    ok: true,
    assetId,
    path,
    token: signed.data.token,
    signedUrl: signed.data.signedUrl,
  };
}

/** Confirm size and MIME, then store width, height and bytes. */
export async function confirmAssetUpload(args: {
  siteId: string;
  assetId: string;
  width: number;
  height: number;
  bytes: number;
}): Promise<AssetConfirmResult> {
  const site = await ownedSite(args.siteId);
  if (!site) return { ok: false, error: "This site is not available." };
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("assets")
    .select("id, path, site_id")
    .eq("id", args.assetId)
    .maybeSingle();
  if (!row || row.site_id !== args.siteId) {
    return { ok: false, error: "Could not save the photo." };
  }
  const info = await admin.storage.from(BUCKET).info(row.path);
  if (info.error || !info.data) {
    return { ok: false, error: "Could not save the photo." };
  }
  const mime = info.data.contentType ?? info.data.metadata?.mimetype;
  if (mime && mime !== "image/webp" && mime !== "image/jpeg") {
    return { ok: false, error: "Could not save the photo." };
  }
  const { error } = await admin
    .from("assets")
    .update({
      width: args.width,
      height: args.height,
      bytes: args.bytes,
      mime: mime === "image/jpeg" ? "image/jpeg" : "image/webp",
    })
    .eq("id", args.assetId);
  if (error) return { ok: false, error: "Could not save the photo." };
  const read = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.path, 60 * 60);
  return {
    ok: true,
    path: row.path,
    readUrl: read.data?.signedUrl ?? "",
  };
}
