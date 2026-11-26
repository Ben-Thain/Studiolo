/** UUID v4, the only id allowed into a storage path. */
const ASSET_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAssetId(value: string): boolean {
  return ASSET_ID.test(value);
}

/**
 * createAssetUpload, confirmAssetUpload and cancelAssetUpload call this
 * before they build a storage path. A bad id deletes nothing.
 */
export function rejectAssetAction(
  siteId: string,
  assetId: string | undefined,
  error: string,
): { ok: false; error: string } | null {
  if (!isAssetId(siteId) || (assetId !== undefined && !isAssetId(assetId))) {
    return { ok: false, error };
  }
  return null;
}

/**
 * A cancel may remove only a pending upload: no confirmed assets row, and
 * nothing an element already references.
 */
export function planAssetCancel(input: {
  assetId?: string;
  confirmedRow: boolean;
  referenced: boolean;
  pathOwnedBySite: boolean;
}): { ok: true; deleteStorage: boolean } | { ok: false; error: string } {
  if (input.assetId !== undefined && !isAssetId(input.assetId)) {
    return { ok: false, error: "Could not cancel the upload." };
  }
  if (input.confirmedRow || input.referenced) {
    return {
      ok: false,
      error: "This photo is already saved and can't be cancelled.",
    };
  }
  if (!input.pathOwnedBySite) {
    return { ok: false, error: "Could not cancel the upload." };
  }
  return { ok: true, deleteStorage: true };
}
