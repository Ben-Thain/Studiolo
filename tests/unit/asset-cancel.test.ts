import { describe, expect, it } from "vitest";
import { planAssetCancel, rejectAssetAction } from "@/lib/assets/cancel-policy";

describe("planAssetCancel", () => {
  it("refuses a confirmed or referenced photo and deletes nothing", () => {
    expect(
      planAssetCancel({
        confirmedRow: true,
        referenced: true,
        pathOwnedBySite: true,
      }),
    ).toEqual({
      ok: false,
      error: "This photo is already saved and can't be cancelled.",
    });
    expect(
      planAssetCancel({
        confirmedRow: true,
        referenced: false,
        pathOwnedBySite: true,
      }).ok,
    ).toBe(false);
    expect(
      planAssetCancel({
        confirmedRow: false,
        referenced: true,
        pathOwnedBySite: true,
      }).ok,
    ).toBe(false);
  });

  it("rejects a path, an empty id and a non-v4 id and deletes nothing", () => {
    const site = "11111111-1111-4111-8111-111111111111";
    for (const assetId of [
      "../x",
      "",
      "11111111-1111-1111-1111-111111111111",
    ]) {
      const plan = planAssetCancel({
        assetId,
        confirmedRow: false,
        referenced: false,
        pathOwnedBySite: true,
      });
      expect(plan).toEqual({
        ok: false,
        error: "Could not cancel the upload.",
      });
      expect(plan).not.toMatchObject({ deleteStorage: true });
      expect(
        rejectAssetAction(site, assetId, "Could not cancel the upload."),
      ).toEqual(plan);
      expect(
        rejectAssetAction(assetId, undefined, "Could not start the upload."),
      ).toEqual({ ok: false, error: "Could not start the upload." });
    }
  });

  it("removes only a pending object on the caller's site", () => {
    expect(
      planAssetCancel({
        confirmedRow: false,
        referenced: false,
        pathOwnedBySite: true,
      }),
    ).toEqual({ ok: true, deleteStorage: true });
  });
});
