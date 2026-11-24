/**
 * Inline links on text and image content (prompt 05).
 */

import { elementLinkSchema } from "./schema";
import type { ElementLink, EditorDoc, LinkKind } from "./types";

export function parseLink(value: unknown): ElementLink | null {
  const parsed = elementLinkSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getContentLink(
  content: Record<string, unknown>,
): ElementLink | null {
  const link = content.link;
  return parseLink(link);
}

export function setContentLink(
  content: Record<string, unknown>,
  link: ElementLink | null,
): Record<string, unknown> {
  if (link === null) {
    const rest = { ...content };
    delete rest.link;
    return rest;
  }
  return { ...content, link };
}

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function makePageLink(pageId: string): ElementLink {
  return { kind: "page", value: pageId };
}

export function makeUrlLink(url: string): ElementLink | null {
  const normalized = normalizeUrl(url);
  return normalized ? { kind: "url", value: normalized } : null;
}

/** True when every page link in the doc targets an existing page. */
export function pageLinksValid(doc: EditorDoc): boolean {
  const pageIds = new Set(doc.pages.map((p) => p.id));
  for (const element of doc.elements) {
    const link = getContentLink(element.content);
    if (link?.kind === "page" && !pageIds.has(link.value)) return false;
  }
  return true;
}

/** Remap page links after a page id change (duplicate flow). */
export function remapPageLinks(
  content: Record<string, unknown>,
  pageMap: Map<string, string>,
): Record<string, unknown> {
  const link = getContentLink(content);
  if (link?.kind !== "page") return content;
  const mapped = pageMap.get(link.value);
  if (!mapped) return content;
  return setContentLink(content, { kind: "page", value: mapped });
}

export function linkLabel(kind: LinkKind): string {
  return kind === "page" ? "Page" : "URL";
}
