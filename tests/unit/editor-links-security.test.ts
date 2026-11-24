import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import {
  makeEmailLink,
  makeUrlLink,
  normalizeEmail,
  normalizeUrl,
  validateLink,
} from "@/editor/links";
import { rivertonHomeDoc } from "../fixtures/riverton-home";

describe("validateLink", () => {
  it("accepts page, https and mailto links", () => {
    const pages = new Set(rivertonHomeDoc.pages.map((p) => p.id));
    expect(
      validateLink({ kind: "page", value: rivertonHomeDoc.pages[0].id }, pages),
    ).toBeTruthy();
    expect(makeUrlLink("https://example.com")?.value).toMatch(
      /^https:\/\/example\.com\/?$/,
    );
    expect(makeEmailLink("hello@example.com")).toEqual({
      kind: "email",
      value: "hello@example.com",
    });
  });

  it("rejects javascript, data, vbscript and protocol-relative URLs", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("data:text/html,hello")).toBeNull();
    expect(normalizeUrl("vbscript:msgbox")).toBeNull();
    expect(normalizeUrl("//evil.example")).toBeNull();
    expect(normalizeUrl("  https://ok.test")).toBe("https://ok.test/");
  });

  it("rejects emails with leading spaces", () => {
    expect(normalizeEmail(" bad@example.com")).toBeNull();
    expect(normalizeEmail("good@example.com")).toBe("good@example.com");
  });

  it("setLink and updateContent drop invalid links", () => {
    const intro = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
    expect(() =>
      applyCommand(rivertonHomeDoc, {
        type: "setLink",
        elementId: intro.id,
        link: { kind: "url", value: "javascript:steal()" },
      }),
    ).toThrow(/Invalid link/);
    const { doc } = applyCommand(rivertonHomeDoc, {
      type: "updateContent",
      elementId: intro.id,
      content: {
        link: { kind: "url", value: "data:text/plain,hi" },
      },
    });
    expect(doc.elements.find((e) => e.id === intro.id)?.content.link).toBe(
      undefined,
    );
  });
});
