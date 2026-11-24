/**
 * Server-safe HTML fragments for editor elements (prompt 05).
 */

import { getContentLink, validateLink } from "./links";
import type { EditorDoc, EditorElement } from "./types";

export function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const STORAGE_BASE = "https://storage.studiolo.invalid/site-assets/";

/** Public URL for a site-owned asset path, or null when the path is unsafe. */
export function resolveAssetUrl(
  siteId: string,
  rawPath: string,
): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath.trim());
  } catch {
    return null;
  }
  if (decoded.includes("\\")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded) || decoded.includes("//")) {
    return null;
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(decoded)) return null;
  const normalized = decoded.replace(/^\/+/, "");
  const segments = normalized.split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    return null;
  }
  if (!normalized.startsWith(`${siteId}/`)) return null;
  let url: URL;
  try {
    url = new URL(normalized, STORAGE_BASE);
  } catch {
    return null;
  }
  const prefix = new URL(`${siteId}/`, STORAGE_BASE).href;
  if (!url.href.startsWith(prefix)) return null;
  return url.href;
}

function assetPath(doc: EditorDoc, assetId: string | null): string | null {
  if (!assetId) return null;
  const asset = doc.assets?.[assetId];
  if (!asset) return null;
  return resolveAssetUrl(doc.siteId, asset.path);
}

function renderLink(
  doc: EditorDoc,
  content: Record<string, unknown>,
  inner: string,
): string {
  const link = getContentLink(content);
  const pageIds = new Set(doc.pages.map((p) => p.id));
  const valid = link ? validateLink(link, pageIds) : null;
  if (!valid) return inner;
  if (valid.kind === "page") {
    const page = doc.pages.find((p) => p.id === valid.value);
    const href = page?.isHome ? "/" : `/${escapeHtml(page?.slug ?? "")}`;
    return `<a href="${href}">${inner}</a>`;
  }
  if (valid.kind === "email") {
    return `<a href="mailto:${escapeHtml(valid.value)}">${inner}</a>`;
  }
  return `<a href="${escapeHtml(valid.value)}" rel="noopener noreferrer">${inner}</a>`;
}

export function renderText(doc: EditorDoc, element: EditorElement): string {
  const text = escapeHtml(String(element.content.text ?? ""));
  return renderLink(doc, element.content, `<span>${text}</span>`);
}

export function renderImage(doc: EditorDoc, element: EditorElement): string {
  const assetId = element.content.assetId as string | null;
  const path = assetPath(doc, assetId);
  const alt = escapeHtml(String(element.content.alt ?? ""));
  if (!path) return `<span data-missing-asset="true"></span>`;
  const img = `<img src="${escapeHtml(path)}" alt="${alt}" />`;
  return renderLink(doc, element.content, img);
}

export function renderNav(doc: EditorDoc): string {
  const items = doc.pages
    .filter((p) => p.inNav)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((page) => {
      const href = page.isHome ? "/" : `/${escapeHtml(page.slug)}`;
      return `<a href="${href}">${escapeHtml(page.title)}</a>`;
    });
  return `<nav>${items.join("")}</nav>`;
}

export function renderForm(element: EditorElement): string {
  const fields = (element.content.fields as string[] | undefined) ?? [];
  const label = escapeHtml(String(element.content.buttonLabel ?? "Send"));
  const inputs = fields
    .map(
      (field) =>
        `<label>${escapeHtml(field)}<input name="${escapeHtml(field)}" /></label>`,
    )
    .join("");
  return `<form>${inputs}<button type="submit">${label}</button></form>`;
}

export function renderElement(doc: EditorDoc, element: EditorElement): string {
  switch (element.type) {
    case "text":
      return renderText(doc, element);
    case "image":
      return renderImage(doc, element);
    case "nav":
      return renderNav(doc);
    case "form":
      return renderForm(element);
    default:
      return "";
  }
}
