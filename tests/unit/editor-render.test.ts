import { describe, expect, it } from "vitest";
import { createDoc } from "@/editor/doc";
import { escapeHtml, renderElement } from "@/editor/render";

const SITE = "40000000-0000-4000-8000-000000000011";
const ASSET = "50000000-0000-4000-8000-000000000001";

describe("render", () => {
  it("escapes hostile text", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("renders only site-owned image paths", () => {
    const doc = createDoc(SITE);
    doc.assets = {
      [ASSET]: { path: `${SITE}/draft/hero.png`, mime: "image/png" },
    };
    doc.elements.push({
      id: "60000000-0000-4000-8000-000000000001",
      pageId: null,
      sectionId: "70000000-0000-4000-8000-000000000001",
      type: "image",
      name: "Hero",
      content: {
        assetId: ASSET,
        alt: '"><img onerror=alert(1)>',
        aspectLocked: true,
        link: { kind: "url", value: "javascript:alert(1)" },
      },
      sortOrder: 0,
    });
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    const html = renderElement(doc, doc.elements[0]);
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    expect(html).toContain(`${SITE}/draft/hero.png`);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img onerror");
    expect(html).toContain("&quot;&gt;&lt;img");
  });

  it("rejects hostile asset paths", () => {
    const doc = createDoc(SITE);
    const evil = `${SITE}/../other/x.png`;
    const makeImage = (path: string) => {
      doc.assets = { [ASSET]: { path } };
      return {
        id: "60000000-0000-4000-8000-000000000002",
        pageId: null,
        sectionId: "70000000-0000-4000-8000-000000000001",
        type: "image" as const,
        name: "Evil",
        content: {
          assetId: ASSET,
          alt: "x",
          aspectLocked: true,
        },
        sortOrder: 0,
      };
    };
    expect(
      renderElement(doc, makeImage(`https://evil.com/${SITE}/x.png`)),
    ).toContain("missing-asset");
    expect(
      renderElement(doc, makeImage(`javascript:alert(1)//${SITE}/x.png`)),
    ).toContain("missing-asset");
    expect(renderElement(doc, makeImage(evil))).toContain("missing-asset");
    expect(
      renderElement(doc, makeImage(`${SITE}/%2e%2e/other/x.png`)),
    ).toContain("missing-asset");
    expect(renderElement(doc, makeImage(`${SITE}/..\\other/x.png`))).toContain(
      "missing-asset",
    );
  });
});
