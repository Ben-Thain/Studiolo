import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const faces = [
  {
    css: "public/fonts/Geist.css",
    files: [
      "public/fonts/geist-latin-400-normal.woff2",
      "public/fonts/geist-latin-500-normal.woff2",
    ],
    licence: "public/fonts/Geist-OFL.txt",
  },
  {
    css: "public/fonts/Manrope.css",
    files: [
      "public/fonts/manrope-latin-400-normal.woff2",
      "public/fonts/manrope-latin-500-normal.woff2",
    ],
    licence: "public/fonts/Manrope-OFL.txt",
  },
  {
    css: "public/fonts/Instrument-Serif.css",
    files: ["public/fonts/instrument-serif-latin-400-normal.woff2"],
    licence: "public/fonts/Instrument-Serif-OFL.txt",
  },
];

describe("self-hosted editor fonts", () => {
  it("points each face at a woff2 file and ships the OFL licence", () => {
    for (const face of faces) {
      const css = readFileSync(face.css, "utf8");
      expect(css).toContain('format("woff2")');
      expect(css).not.toContain("local(");
      for (const file of face.files) {
        expect(css).toContain(file.slice("public/fonts/".length));
        expect(statSync(file).size).toBeGreaterThan(1000);
      }
      expect(readFileSync(face.licence, "utf8")).toContain(
        "SIL Open Font License",
      );
    }
  });
});
