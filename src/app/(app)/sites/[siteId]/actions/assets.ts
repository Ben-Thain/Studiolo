"use server";

import { imageSize } from "@/lib/assets/image-bytes";
import { planAssetCancel, rejectAssetAction } from "@/lib/assets/cancel-policy";
import { READ_URL_TTL_SECONDS } from "@/lib/assets/read-url-refresh";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "site-assets";
const MAX_BYTES = 8 * 1024 * 1024;

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
  | {
      ok: true;
      path: string;
      readUrl: string;
      readUrlExpiresAt: number;
      width: number;
      height: number;
      bytes: number;
    }
  | { ok: false; error: string };

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

/** Signed upload URL only. The assets row is inserted on confirm. */
export async function createAssetUpload(
  siteId: string,
): Promise<AssetUploadTicket> {
  // TODO(15): an object uploaded but never confirmed (tab closed mid-upload)
  // stays in storage. Prompt 15 owns that cleanup; do not add a cron here.
  const denied = rejectAssetAction(
    siteId,
    undefined,
    "Could not start the upload.",
  );
  if (denied) return denied;
  const site = await ownedSite(siteId);
  if (!site) return { ok: false, error: "This site is not available." };
  const admin = createAdminClient();
  const assetId = crypto.randomUUID();
  const path = `${siteId}/draft/${assetId}.webp`;
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

/** Insert the assets row from the stored object, not the client's dimensions. */
export async function confirmAssetUpload(args: {
  siteId: string;
  assetId: string;
  bytes: number;
}): Promise<AssetConfirmResult> {
  const denied = rejectAssetAction(
    args.siteId,
    args.assetId,
    "Could not save the photo.",
  );
  if (denied) return denied;
  const site = await ownedSite(args.siteId);
  if (!site) return { ok: false, error: "This site is not available." };
  const path = `${args.siteId}/draft/${args.assetId}.webp`;
  const admin = createAdminClient();
  const info = await admin.storage.from(BUCKET).info(path);
  if (info.error || !info.data) {
    return { ok: false, error: "Could not save the photo." };
  }
  const mime = info.data.contentType ?? info.data.metadata?.mimetype;
  if (mime !== "image/webp" && mime !== "image/jpeg") {
    return { ok: false, error: "Could not save the photo." };
  }
  const rawSize = info.data.size ?? info.data.metadata?.size;
  const storedBytes =
    typeof rawSize === "number"
      ? rawSize
      : typeof rawSize === "string"
        ? Number.parseInt(rawSize, 10)
        : NaN;
  if (
    !Number.isFinite(storedBytes) ||
    storedBytes <= 0 ||
    storedBytes > MAX_BYTES
  ) {
    return { ok: false, error: "Could not save the photo." };
  }
  if (storedBytes !== args.bytes) {
    return { ok: false, error: "Could not save the photo." };
  }
  const downloaded = await admin.storage.from(BUCKET).download(path);
  if (downloaded.error || !downloaded.data) {
    return { ok: false, error: "Could not save the photo." };
  }
  const buffer = new Uint8Array(await downloaded.data.arrayBuffer());
  if (buffer.byteLength !== storedBytes) {
    return { ok: false, error: "Could not save the photo." };
  }
  const size = imageSize(buffer);
  if (!size || size.width < 1 || size.height < 1) {
    return { ok: false, error: "Could not save the photo." };
  }
  const { error } = await admin.from("assets").insert({
    id: args.assetId,
    site_id: args.siteId,
    path,
    width: size.width,
    height: size.height,
    bytes: storedBytes,
    mime: mime === "image/jpeg" ? "image/jpeg" : "image/webp",
  });
  if (error) return { ok: false, error: "Could not save the photo." };
  const read = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, READ_URL_TTL_SECONDS);
  return {
    ok: true,
    path,
    readUrl: read.data?.signedUrl ?? "",
    readUrlExpiresAt: Math.floor(Date.now() / 1000) + READ_URL_TTL_SECONDS,
    width: size.width,
    height: size.height,
    bytes: storedBytes,
  };
}

/** Re-sign every photo on the site in one batch, before the 3600s URLs expire. */
export async function refreshAssetReadUrls(siteId: string): Promise<
  | {
      ok: true;
      assets: Record<string, { readUrl: string; readUrlExpiresAt: number }>;
    }
  | { ok: false; error: string }
> {
  const site = await ownedSite(siteId);
  if (!site) return { ok: false, error: "This site is not available." };
  const admin = createAdminClient();
  const { data } = await admin
    .from("assets")
    .select("id, path")
    .eq("site_id", siteId);
  const rows = data ?? [];
  if (!rows.length) return { ok: true, assets: {} };
  const signed = await admin.storage.from(BUCKET).createSignedUrls(
    rows.map((row) => row.path),
    READ_URL_TTL_SECONDS,
  );
  const byPath = new Map(
    (signed.data ?? []).map((item) => [item.path, item.signedUrl]),
  );
  const expiresAt = Math.floor(Date.now() / 1000) + READ_URL_TTL_SECONDS;
  const assets: Record<string, { readUrl: string; readUrlExpiresAt: number }> =
    {};
  for (const row of rows) {
    const readUrl = byPath.get(row.path);
    if (readUrl) assets[row.id] = { readUrl, readUrlExpiresAt: expiresAt };
  }
  return { ok: true, assets };
}

/** Remove a pending object. Confirmed or referenced photos are left in place. */
export async function cancelAssetUpload(
  siteId: string,
  assetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const denied = rejectAssetAction(
    siteId,
    assetId,
    "Could not cancel the upload.",
  );
  if (denied) return denied;
  const site = await ownedSite(siteId);
  if (!site) return { ok: false, error: "This site is not available." };
  const admin = createAdminClient();
  const path = `${siteId}/draft/${assetId}.webp`;
  const { data: row } = await admin
    .from("assets")
    .select("id, path, site_id")
    .eq("id", assetId)
    .maybeSingle();
  const confirmed = Boolean(row && row.site_id === siteId);
  const { data: used } = await admin
    .from("elements")
    .select("id")
    .eq("site_id", siteId)
    .contains("content", { assetId })
    .limit(1);
  const plan = planAssetCancel({
    assetId,
    confirmedRow: confirmed || Boolean(row),
    referenced: (used?.length ?? 0) > 0,
    pathOwnedBySite: path.startsWith(`${siteId}/`),
  });
  if (!plan.ok) return plan;
  if (plan.deleteStorage) {
    await admin.storage.from(BUCKET).remove([path]);
  }
  return { ok: true };
}
