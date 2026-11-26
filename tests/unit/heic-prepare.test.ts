import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { UNSUPPORTED_PHOTO, prepareImage } from "@/lib/images/prepare";

const fixturePath = path.join(process.cwd(), "tests/fixtures/sample.heic");

describe("HEIC prepareImage", () => {
  it("converts tests/fixtures/sample.heic to a raster image", async () => {
    const bytes = await readFile(fixturePath);
    expect(bytes.subarray(4, 8).toString("ascii")).toBe("ftyp");
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
      await page.addScriptTag({
        path: path.join(
          process.cwd(),
          "node_modules/heic2any/dist/heic2any.js",
        ),
      });
      const size = await page.evaluate(async (b64) => {
        const binary = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
        const blob = new Blob([binary], { type: "image/heic" });
        const convert = (
          window as unknown as {
            heic2any: (opts: {
              blob: Blob;
              toType: string;
              quality: number;
            }) => Promise<Blob | Blob[]>;
          }
        ).heic2any;
        const result = await convert({
          blob,
          toType: "image/webp",
          quality: 0.8,
        });
        const out = Array.isArray(result) ? result[0]! : result;
        return out.size;
      }, bytes.toString("base64"));
      expect(size).toBeGreaterThan(100);
    } finally {
      await browser.close();
    }
  });

  it("surfaces unsupported when heic2any fails", async () => {
    const file = new File([new Uint8Array([0, 1, 2, 3])], "bad.heic", {
      type: "image/heic",
    });
    await expect(prepareImage(file)).rejects.toThrow(UNSUPPORTED_PHOTO);
  });
});
