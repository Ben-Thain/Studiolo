import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import { FONT_FAMILIES, SIZE_STEPS } from "@/editor/fonts";
import { parseTextContent } from "@/editor/content";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

describe("content types", () => {
  it("rejects size 7, Papyrus and weight 900", () => {
    expect(() =>
      parseTextContent({
        text: "Bad",
        fontFamily: "Papyrus",
        fontSize: 18,
        fontWeight: 400,
        align: "left",
      }),
    ).toThrow();
    expect(() =>
      parseTextContent({
        text: "Bad",
        fontFamily: "Inter",
        fontSize: 7,
        fontWeight: 400,
        align: "left",
      }),
    ).toThrow();
    expect(() =>
      parseTextContent({
        text: "Bad",
        fontFamily: "Inter",
        fontSize: 18,
        fontWeight: 900,
        align: "left",
      }),
    ).toThrow();
  });

  it("accepts every spec font, size and weight", () => {
    for (const fontFamily of FONT_FAMILIES) {
      for (const fontSize of SIZE_STEPS) {
        for (const fontWeight of [400, 500] as const) {
          expect(
            parseTextContent({
              text: "Ok",
              fontFamily,
              fontSize,
              fontWeight,
              align: "left",
            }).fontFamily,
          ).toBe(fontFamily);
        }
      }
    }
  });

  it("rejects invalid text patches in updateContent", () => {
    const intro = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
    expect(() =>
      applyCommand(rivertonHomeDoc, {
        type: "updateContent",
        elementId: intro.id,
        content: { fontFamily: "Papyrus" },
      }),
    ).toThrow();
  });
});
