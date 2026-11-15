/**
 * The post-sign-in destination. Only a same-origin relative path is allowed:
 * it must start with a single "/", never "//" or "/\", and carry no scheme,
 * host or control characters. Anything else is ignored (returns null).
 */
export function safeNext(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (candidate.length === 0 || candidate.length > 2048) return null;
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return null;
  // Tabs, newlines and other control characters are stripped by URL parsers,
  // which can turn "/\t/evil.com" into "//evil.com".
  if (/[\u0000-\u001f\u007f\\]/.test(candidate)) return null;

  const base = "http://studiolo.invalid";
  let parsed: URL;
  try {
    parsed = new URL(candidate, base);
  } catch {
    return null;
  }
  if (parsed.origin !== base) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** `/login?next=…` (or `/signup`) for a protected path, keeping only a safe next. */
export function authHref(
  page: "/login" | "/signup",
  next: string | null | undefined,
): string {
  const safe = safeNext(next);
  return safe ? `${page}?next=${encodeURIComponent(safe)}` : page;
}
