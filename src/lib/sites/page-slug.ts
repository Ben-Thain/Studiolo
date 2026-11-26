/**
 * Page addresses inside one site. The database allows "" or 1–50 characters
 * (pages_slug_format). These words are reserved because they collide with
 * app or site paths.
 */

export const PAGE_SLUG_MAX = 50;

export const PAGE_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/;

export const RESERVED_PAGE_SLUGS = [
  "s",
  "api",
  "_next",
  "gate",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "templates",
] as const;

const RESERVED = new Set<string>(RESERVED_PAGE_SLUGS);

export function isReservedPageSlug(slug: string): boolean {
  return RESERVED.has(slug);
}

export function isValidPageSlug(slug: string): boolean {
  return PAGE_SLUG_PATTERN.test(slug) && !isReservedPageSlug(slug);
}

export function pageSlugError(slug: string): string | null {
  if (!slug) return null;
  if (isReservedPageSlug(slug)) return "That address is reserved.";
  if (!PAGE_SLUG_PATTERN.test(slug)) return "Use letters, numbers and hyphens.";
  return null;
}

/** A page address derived from a title. May still be reserved or taken. */
export function derivePageSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PAGE_SLUG_MAX)
    .replace(/-+$/, "");
  return slug;
}
