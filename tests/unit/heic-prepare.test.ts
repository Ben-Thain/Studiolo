import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { UNSUPPORTED_PHOTO, prepareImage } from "@/lib/images/prepare";

const fixturePath = path.join(process.cwd(), "tests/fixtures/sample.heic");

describe("HEIC prepareImage", () => {
  it("converts a HEIC fixture when present", async () => {
    let bytes: Buffer;
    try {
      bytes = await readFile(fixturePath);
    } catch {
      return;
    }
    if (!bytes.byteLength) return;
    const file = new File([new Uint8Array(bytes)], "sample.heic", {
      type: "image/heic",
    });
    const prepared = await prepareImage(file);
    expect(prepared.mime).toMatch(/^image\/(webp|jpeg)$/);
    expect(prepared.width).toBeGreaterThan(0);
    expect(prepared.height).toBeGreaterThan(0);
  });

  it("surfaces unsupported when heic2any fails", async () => {
    const file = new File([new Uint8Array([0, 1, 2, 3])], "bad.heic", {
      type: "image/heic",
    });
    await expect(prepareImage(file)).rejects.toThrow(UNSUPPORTED_PHOTO);
  });
});
