import { describe, expect, it } from "vitest";
import {
  PHOTO_TOO_LARGE,
  UNSUPPORTED_PHOTO,
  assertEncodedSize,
  prepareImage,
} from "@/lib/images/prepare";

describe("prepareImage", () => {
  it("rejects a file that is not a photo", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    await expect(prepareImage(file)).rejects.toThrow(UNSUPPORTED_PHOTO);
  });

  it("rejects compressed output over 8MB", () => {
    expect(() => assertEncodedSize(8 * 1024 * 1024 + 1)).toThrow(
      PHOTO_TOO_LARGE,
    );
  });
});
