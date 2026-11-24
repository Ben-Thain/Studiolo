/**
 * Inline links on text and image content (prompt 05).
 */

import { elementLinkSchema } from "./schema";
import type { DraftChanges } from "./schema";
import type { EditorDoc, ElementLink, LinkKind } from "./types";

const UNSAFE_PROTOCOL = /^\s*(javascript|data|vbscript):/i;
const PROTOCOL_RELATIVE = /^\s*\/\//;

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
  if (PROTOCOL_RELATIVE.test(trimmed)) return null;
  if (UNSAFE_PROTOCOL.test(trimmed)) return null;
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || EMAIL_PATTERN.test(trimmed) === false) return null;
  if (/\s/.test(raw) && raw !== trimmed) return null;
  return trimmed.toLowerCase();
}

export function validateLink(
  link: unknown,
  pageIds?: Set<string>,
): ElementLink | null {
  const parsed = parseLink(link);
  if (!parsed) return null;
  switch (parsed.kind) {
    case "page":
      if (pageIds && !pageIds.has(parsed.value)) return null;
      return parsed;
    case "url": {
      const url = normalizeUrl(parsed.value);
      return url ? { kind: "url", value: url } : null;
    }
    case "email": {
      const email = normalizeEmail(parsed.value);
      return email ? { kind: "email", value: email } : null;
    }
    default:
      return null;
  }
}

/** Strip invalid links from every element content row in a save payload. */
export function sanitizeChangesLinks(
  changes: DraftChanges,
  pageIds: Set<string>,
): DraftChanges {
  const next = { ...changes };
  if (next.elements?.upsert) {
    next.elements = {
      ...next.elements,
      upsert: next.elements.upsert.map((row) => ({
        ...row,
        content: sanitizeContentLinks(
          row.content as Record<string, unknown>,
          pageIds,
        ),
      })),
    };
  }
  return next;
}

export function sanitizeContentLinks(
  content: Record<string, unknown>,
  pageIds: Set<string>,
): Record<string, unknown> {
  const link = getContentLink(content);
  if (!link) return content;
  const valid = validateLink(link, pageIds);
  if (!valid) {
    return setContentLink(content, null);
  }
  return setContentLink(content, valid);
}

export function makePageLink(pageId: string): ElementLink {
  return { kind: "page", value: pageId };
}

export function makeUrlLink(url: string): ElementLink | null {
  const normalized = normalizeUrl(url);
  return normalized ? { kind: "url", value: normalized } : null;
}

export function makeEmailLink(email: string): ElementLink | null {
  const normalized = normalizeEmail(email);
  return normalized ? { kind: "email", value: normalized } : null;
}

/** True when every page link in the doc targets an existing page. */
export function pageLinksValid(doc: EditorDoc): boolean {
  const pageIds = new Set(doc.pages.map((p) => p.id));
  for (const element of doc.elements) {
    const link = getContentLink(element.content);
    if (link && !validateLink(link, pageIds)) return false;
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
  if (kind === "page") return "Page";
  if (kind === "email") return "Email";
  return "URL";
}
