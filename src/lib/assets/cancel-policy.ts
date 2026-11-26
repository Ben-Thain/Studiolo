/**
 * A cancel may remove only a pending upload: no confirmed assets row, and
 * nothing an element already references.
 */
export function planAssetCancel(input: {
  confirmedRow: boolean;
  referenced: boolean;
  pathOwnedBySite: boolean;
}): { ok: true; deleteStorage: boolean } | { ok: false; error: string } {
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
