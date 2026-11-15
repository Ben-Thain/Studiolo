/**
 * Site addresses (slugs), prompt 04a. The database is the authority
 * (sites_slug_format, reserved_slugs, slug_is_free); these helpers only derive
 * a first suggestion from the name and pre-check the format.
 */

export const SLUG_MAX = 40;

/** Same rule as the sites_slug_format check: 3–40 of a–z, 0–9, "-". */
export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

// Letters NFKD does not split into a base letter and a mark.
const FOLDS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ð: "d",
  ł: "l",
  þ: "th",
  ı: "i",
};

/**
 * Lowercase, ASCII-fold (é→e), non-alphanumerics → "-", collapse and trim
 * dashes, cut to 40; shorter than 3 → pad with "-site".
 */
export function deriveSlug(name: string): string {
  let slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ßæœøđðłþı]/g, (ch) => FOLDS[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  slug = slug.slice(0, SLUG_MAX).replace(/-+$/, "");
  if (slug.length < 3) slug = `${slug}-site`.replace(/^-+/, "");
  return slug;
}

/** `<base>-<n>`, cutting the base so the result stays within 40. */
export function withSuffix(base: string, n: number): string {
  const suffix = `-${n}`;
  const cut = base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, "");
  return `${cut}${suffix}`;
}
