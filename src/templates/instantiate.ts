import type { DraftChanges } from "@/editor/schema";
import { legacy12To96 } from "@/editor/grid";
import type { TemplateFile } from "./schema";

export type InstantiatedAsset = {
  id: string;
  path: string;
  width: number;
  height: number;
  mime: string;
  bytes: number;
  blurDataUrl: string;
};

export type TemplateUpload = {
  assetId: string;
  file: string;
};

export type InstantiatedTemplate = {
  changes: DraftChanges;
  assets: InstantiatedAsset[];
  uploads: TemplateUpload[];
  homePageId: string;
};

type IdFactory = () => string;

function remapId(map: Map<string, string>, local: string, newId: IdFactory) {
  const existing = map.get(local);
  if (existing) return existing;
  const id = newId();
  map.set(local, id);
  return id;
}

function replaceName(value: string, siteName: string) {
  return value.replaceAll("{{site.name}}", siteName);
}

/**
 * Copy a template into save_draft changes for one new site.
 * Local ids, page links and asset keys become new uuids. {{site.name}}
 * becomes the site name. Layouts stay in the template's 12-column units.
 */
export function instantiateTemplate(
  template: TemplateFile,
  options: { siteId: string; siteName: string; newId?: IdFactory },
): InstantiatedTemplate {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const pages = new Map<string, string>();
  const sections = new Map<string, string>();
  const elements = new Map<string, string>();
  const assets = new Map<string, string>();

  for (const page of template.pages) remapId(pages, page.id, newId);
  for (const section of template.sections) remapId(sections, section.id, newId);
  for (const element of template.elements) remapId(elements, element.id, newId);
  for (const asset of template.assets) remapId(assets, asset.key, newId);

  const pageId = (local: string | null) =>
    local === null ? null : (pages.get(local) ?? null);

  const assetRows: InstantiatedAsset[] = template.assets.map((asset) => {
    const id = assets.get(asset.key)!;
    return {
      id,
      path: `${options.siteId}/draft/${id}.webp`,
      width: asset.width,
      height: asset.height,
      mime: asset.mime,
      bytes: asset.bytes,
      blurDataUrl: asset.blurDataUrl,
    };
  });

  const changes: DraftChanges = {
    pages: {
      upsert: template.pages.map((page) => ({
        id: pages.get(page.id)!,
        title: page.title,
        slug: page.slug,
        sort_order: page.sortOrder,
        in_nav: page.inNav,
        is_home: page.isHome,
      })),
    },
    sections: {
      upsert: template.sections.map((section) => ({
        id: sections.get(section.id)!,
        page_id: pageId(section.pageId),
        name: section.name,
        sort_order: section.sortOrder,
      })),
    },
    elements: {
      upsert: template.elements.map((element) => ({
        id: elements.get(element.id)!,
        page_id: pageId(element.pageId),
        section_id: sections.get(element.sectionId)!,
        type: element.type,
        name: element.name,
        sort_order: element.sortOrder,
        content: remapContent(element.content, {
          siteName: options.siteName,
          pages,
          assets,
        }),
      })),
    },
    element_layouts: {
      upsert: template.elements.flatMap((element) => {
        const boxes = template.layouts[element.id];
        if (!boxes) return [];
        return (["desktop", "mobile"] as const).map((breakpoint) => {
          const box = boxes[breakpoint];
          const columns = legacy12To96({
            col: box.colStart,
            span: box.colSpan,
          });
          return {
            id: newId(),
            element_id: elements.get(element.id)!,
            breakpoint,
            col_start: columns.col,
            col_span: columns.span,
            row_start: box.rowStart,
            row_span: box.rowSpan,
            hidden: box.hidden,
            placement_source: box.placementSource,
            z_index: 0,
          };
        });
      }),
    },
  };

  const home = template.pages.find((page) => page.isHome);
  if (!home) throw new Error("Template has no home page");

  return {
    changes,
    assets: assetRows,
    uploads: template.assets.map((asset) => ({
      assetId: assets.get(asset.key)!,
      file: asset.file,
    })),
    homePageId: pages.get(home.id)!,
  };
}

function remapContent(
  content: Record<string, unknown>,
  maps: {
    siteName: string;
    pages: Map<string, string>;
    assets: Map<string, string>;
  },
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...content };
  if (typeof next.text === "string") {
    next.text = replaceName(next.text, maps.siteName);
  }
  if (typeof next.assetKey === "string") {
    const assetId = maps.assets.get(next.assetKey);
    if (!assetId) throw new Error(`Unknown asset key ${next.assetKey}`);
    next.assetId = assetId;
    delete next.assetKey;
  }
  const link = next.link;
  if (link && typeof link === "object") {
    const value = link as { kind?: string; value?: string };
    if (value.kind === "page" && typeof value.value === "string") {
      const pageId = maps.pages.get(value.value);
      if (!pageId) throw new Error(`Unknown page link ${value.value}`);
      next.link = { kind: "page", value: pageId };
    }
  }
  return next;
}
