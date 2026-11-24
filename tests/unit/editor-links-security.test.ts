import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import {
  makeEmailLink,
  makeUrlLink,
  normalizeEmail,
  normalizeUrl,
  sanitizeChangesLinks,
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

  it("rejects mailto query parameters on email links", () => {
    expect(normalizeEmail("hello@example.com?body=steal")).toBeNull();
    expect(
      normalizeEmail("mailto:hello@example.com?cc=evil@example.com"),
    ).toBeNull();
  });

  it("rejects emails with leading spaces", () => {
    expect(normalizeEmail(" bad@example.com")).toBeNull();
    expect(normalizeEmail("good@example.com")).toBe("good@example.com");
  });

  it("sanitizeChangesLinks drops unknown page ids", () => {
    const validPage = rivertonHomeDoc.pages[0].id;
    const changes = {
      elements: {
        upsert: [
          {
            id: "el",
            page_id: validPage,
            section_id: "s",
            type: "text" as const,
            name: "T",
            content: {
              link: {
                kind: "page" as const,
                value: "00000000-0000-0000-0000-000000000099",
              },
            },
            sort_order: 0,
          },
        ],
      },
    };
    const safe = sanitizeChangesLinks(changes, new Set([validPage]));
    expect(safe.elements?.upsert?.[0]?.content.link).toBeUndefined();
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
