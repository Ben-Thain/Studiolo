const BASE = "http://studiolo.invalid";

/** Normalises one candidate; null when it is not a same-origin path. */
function normalise(candidate: string): string | null {
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return null;
  // Tabs, newlines and other control characters are stripped by URL parsers,
  // which can turn "/\t/evil.com" into "//evil.com".
  if (/[\u0000-\u001f\u007f\\]/.test(candidate)) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate, BASE);
  } catch {
    return null;
  }
  if (parsed.origin !== BASE) return null;
  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  // Dot segments collapse during parsing: "/.//evil.com", "/..//evil.com",
  // "/%2e%2e//evil.com" and "/x/..//evil.com" all become "//evil.com", which
  // a later `new URL(path, origin)` reads as another host.
  if (path.startsWith("//") || path.startsWith("/\\")) return null;
  if (new URL(path, BASE).origin !== BASE) return null;
  return path;
}

/**
 * The post-sign-in destination. Only a same-origin relative path is allowed:
 * it must start with a single "/", never "//" or "/\", and carry no scheme,
 * host or control characters, before and after URL normalisation. `next`
 * travels through more than one URL (the login page, then the email link to
 * the callback), so each further percent-decoding of the value must be safe
 * too: "/%252e%252e//evil.com" is refused. Anything else returns null.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (candidate.length === 0 || candidate.length > 2048) return null;

  const result = normalise(candidate);
  if (!result) return null;

  let layer = candidate;
  for (let i = 0; i < 4; i += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(layer);
    } catch {
      break; // a stray "%" cannot be decoded further, so it cannot hide "//"
    }
    if (decoded === layer) break;
    if (!normalise(decoded)) return null;
    layer = decoded;
  }
  return result;
}

/** True when `path` resolves on `origin` itself. */
export function sameOrigin(path: string, origin: string): boolean {
  try {
    return new URL(path, origin).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

/** `/login?next=…` (or `/signup`) for a protected path, keeping only a safe next. */
export function authHref(
  page: "/login" | "/signup",
  next: string | null | undefined,
): string {
  const safe = safeNext(next);
  return safe ? `${page}?next=${encodeURIComponent(safe)}` : page;
}
