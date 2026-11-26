import { describe, expect, it } from "vitest";
import { planAssetCancel } from "@/lib/assets/cancel-policy";

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
