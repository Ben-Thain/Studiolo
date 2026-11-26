import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyCommand } from "@/editor/commands";
import { applyInverse, inverseChanges, snapshotDoc } from "@/editor/changes";
import {
  createDoc,
  elementFromRow,
  layoutFromRow,
  pageFromRow,
  sectionFromRow,
} from "@/editor/doc";
import { legacy12To96 } from "@/editor/grid";
import { draftChangesSchema, editorDocSchema } from "@/editor/schema";
import { createHistory, pushHistory, undo } from "@/editor/history";
import { instantiateTemplate } from "@/templates/instantiate";
import { TEMPLATE_ORDER, loadTemplate } from "@/templates/index";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function boxesOverlap(
  a: { col: number; span: number; row: number; rows: number },
  b: { col: number; span: number; row: number; rows: number },
) {
  const ax2 = a.col + a.span;
  const bx2 = b.col + b.span;
  const ay2 = a.row + a.rows;
  const by2 = b.row + b.rows;
  return a.col < bx2 && b.col < ax2 && a.row < by2 && b.row < ay2;
}

describe("templates", () => {
  it("parses every template and points at real files and ids", () => {
    for (const id of TEMPLATE_ORDER) {
      const template = loadTemplate(id);
      expect(template.id).toBe(id);
      const pageIds = new Set(template.pages.map((page) => page.id));
      const sectionIds = new Set(
        template.sections.map((section) => section.id),
      );
      const elementIds = new Set(
        template.elements.map((element) => element.id),
      );
      const assetKeys = new Set(template.assets.map((asset) => asset.key));
      expect(template.pages.filter((page) => page.isHome)).toHaveLength(1);
      for (const asset of template.assets) {
        const file = path.join(
          process.cwd(),
          "public/templates",
          id,
          asset.file,
        );
        expect(existsSync(file), file).toBe(true);
        expect(asset.bytes).toBeGreaterThan(0);
      }
      expect(
        existsSync(
          path.join(
            process.cwd(),
            "public/templates",
            id,
            "thumb-desktop.webp",
          ),
        ),
      ).toBe(true);
      for (const element of template.elements) {
        expect(elementIds.has(element.id)).toBe(true);
        expect(sectionIds.has(element.sectionId)).toBe(true);
        if (element.pageId) expect(pageIds.has(element.pageId)).toBe(true);
        expect(template.layouts[element.id]?.desktop).toBeTruthy();
        expect(template.layouts[element.id]?.mobile).toBeTruthy();
        const key = element.content.assetKey;
        if (typeof key === "string") expect(assetKeys.has(key)).toBe(true);
        const link = element.content.link as
          { kind?: string; value?: string } | undefined;
        if (link?.kind === "page")
          expect(pageIds.has(String(link.value))).toBe(true);
        if (element.type === "text")
          expect(element.content.fontFamily).toBe("Inter");
      }
      for (const section of template.sections) {
        for (const breakpoint of ["desktop", "mobile"] as const) {
          const visible = template.elements
            .filter((element) => element.sectionId === section.id)
            .map((element) => template.layouts[element.id]![breakpoint])
            .filter((box) => !box.hidden);
          for (let i = 0; i < visible.length; i++) {
            for (let j = i + 1; j < visible.length; j++) {
              const a = visible[i]!;
              const b = visible[j]!;
              expect(
                boxesOverlap(
                  {
                    ...legacy12To96({ col: a.colStart, span: a.colSpan }),
                    row: a.rowStart,
                    rows: a.rowSpan,
                  },
                  {
                    ...legacy12To96({ col: b.colStart, span: b.colSpan }),
                    row: b.rowStart,
                    rows: b.rowSpan,
                  },
                ),
                `${id} ${section.name} ${breakpoint}`,
              ).toBe(false);
            }
          }
        }
      }
    }
  });

  it("instantiate leaves no assetKey, {{site.name}} or local id", () => {
    let n = 0;
    const newId = () =>
      `11111111-1111-4111-8111-${String(++n).padStart(12, "0")}`;
    for (const id of TEMPLATE_ORDER) {
      const made = instantiateTemplate(loadTemplate(id), {
        siteId: "22222222-2222-4222-8222-222222222222",
        siteName: "Hollin Field",
        newId,
      });
      const raw = JSON.stringify(made);
      expect(raw).not.toContain("assetKey");
      expect(raw).not.toContain("{{site.name}}");
      expect(raw).not.toMatch(/"p_\d+"/);
      expect(raw).not.toMatch(/"s_\d+"/);
      expect(raw).not.toMatch(/"e_\d+"/);
      expect(made.homePageId).toMatch(UUID);
      for (const asset of made.assets) {
        expect(asset.path).toBe(
          `22222222-2222-4222-8222-222222222222/draft/${asset.id}.webp`,
        );
        expect(asset.bytes).toBeGreaterThan(0);
      }
      const parsed = draftChangesSchema.parse(made.changes);
      const doc = createDoc("22222222-2222-4222-8222-222222222222");
      doc.pages = parsed.pages!.upsert!.map(pageFromRow);
      doc.sections = parsed.sections!.upsert!.map(sectionFromRow);
      doc.elements = parsed.elements!.upsert!.map(elementFromRow);
      doc.layouts = parsed.element_layouts!.upsert!.map(layoutFromRow);
      expect(editorDocSchema.parse(doc).siteId).toBe(doc.siteId);
      expect(draftChangesSchema.parse(made.changes).pages?.upsert?.length).toBe(
        loadTemplate(id).pages.length,
      );
    }
  });
});

describe("sample flag", () => {
  it("drops sample when text or the image changes, and undo restores it", () => {
    let n = 0;
    const newId = () =>
      `33333333-3333-4333-8333-${String(++n).padStart(12, "0")}`;
    const made = instantiateTemplate(loadTemplate("still"), {
      siteId: "44444444-4444-4444-8444-444444444444",
      siteName: "Hollin Field",
      newId,
    });
    const doc = createDoc("44444444-4444-4444-8444-444444444444");
    doc.pages = made.changes.pages!.upsert!.map(pageFromRow);
    doc.sections = made.changes.sections!.upsert!.map(sectionFromRow);
    doc.elements = made.changes.elements!.upsert!.map(elementFromRow);
    doc.layouts = made.changes.element_layouts!.upsert!.map(layoutFromRow);
    const text = doc.elements.find(
      (element) => element.type === "text" && element.content.sample === true,
    )!;
    const image = doc.elements.find(
      (element) => element.type === "image" && element.content.sample === true,
    )!;
    const before = snapshotDoc(doc);
    const edited = applyCommand(doc, {
      type: "updateContent",
      elementId: text.id,
      content: { text: "Mine" },
    }).doc;
    expect(
      edited.elements.find((element) => element.id === text.id)?.content.sample,
    ).toBeUndefined();
    const history = pushHistory(
      createHistory(),
      inverseChanges(edited, before),
    );
    const undone = undo(edited, history);
    expect(
      undone?.doc.elements.find((element) => element.id === text.id)?.content
        .sample,
    ).toBe(true);

    const imageBefore = snapshotDoc(undone!.doc);
    const replacedDoc = applyCommand(undone!.doc, {
      type: "updateContent",
      elementId: image.id,
      content: { assetId: "55555555-5555-4555-8555-555555555555" },
    }).doc;
    expect(
      replacedDoc.elements.find((element) => element.id === image.id)?.content
        .sample,
    ).toBeUndefined();
    const restored = applyInverse(
      replacedDoc,
      inverseChanges(replacedDoc, imageBefore),
    );
    expect(
      restored.elements.find((element) => element.id === image.id)?.content
        .sample,
    ).toBe(true);

    const styled = applyCommand(restored, {
      type: "updateContent",
      elementId: text.id,
      content: { align: "center" },
    }).doc;
    expect(
      styled.elements.find((element) => element.id === text.id)?.content.sample,
    ).toBe(true);
  });
});
