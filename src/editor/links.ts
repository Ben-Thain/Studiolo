/**
 * Inline links on text and image content (prompt 05).
 */

import { z } from "zod";
import type { DraftChanges } from "./schema";
import type { EditorDoc, ElementLink, LinkKind } from "./types";

const UNSAFE_PROTOCOL = /^\s*(javascript|data|vbscript):/i;
const PROTOCOL_RELATIVE = /^\s*\/\//;
const MAILTO_QUERY = /\?|#/;

const linkKindSchema = z.enum(["page", "url", "email"]);

const linkShape = z.object({
  kind: linkKindSchema,
  value: z.string().min(1),
});

export const elementLinkSchema = linkShape.superRefine((link, ctx) => {
  if (validateLink(link) === null) {
    ctx.addIssue({ code: "custom", message: "Invalid link" });
  }
});

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
  const stripped = raw.trim().replace(/^mailto:/i, "");
  if (MAILTO_QUERY.test(stripped)) return null;
  const trimmed = stripped.trim();
  if (!trimmed || EMAIL_PATTERN.test(trimmed) === false) return null;
  if (/\s/.test(raw) && raw !== trimmed) return null;
  return trimmed.toLowerCase();
}

/** Page links whose target is not in the document. Format is still valid. */
export function missingPageLinks(
  doc: EditorDoc,
): { elementId: string; pageId: string }[] {
  const ids = new Set(doc.pages.map((page) => page.id));
  const missing: { elementId: string; pageId: string }[] = [];
  for (const element of doc.elements) {
    const link = element.content.link;
    if (
      link &&
      typeof link === "object" &&
      (link as ElementLink).kind === "page" &&
      typeof (link as ElementLink).value === "string" &&
      !ids.has((link as ElementLink).value)
    ) {
      missing.push({
        elementId: element.id,
        pageId: (link as ElementLink).value,
      });
    }
  }
  return missing;
}

export function validateLink(
  link: unknown,
  pageIds?: Set<string>,
): ElementLink | null {
  const shaped = linkShape.safeParse(link);
  if (!shaped.success) return null;
  const parsed = shaped.data;
  switch (parsed.kind) {
    case "page":
      if (!z.uuid().safeParse(parsed.value).success) return null;
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
  if (!("link" in content) || content.link == null) return content;
  const valid = validateLink(content.link, pageIds);
  if (!valid) return setContentLink(content, null);
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
