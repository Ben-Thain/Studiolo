/**
 * Site-owned storage path validation (shared by render and URL builders).
 */

/** Returns a normalized site-scoped path or null when the path is unsafe. */
export function validateSiteAssetPath(
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
  return normalized;
}

export function buildStoragePublicUrl(base: string, path: string): string {
  const trimmedBase = base.endsWith("/") ? base : `${base}/`;
  return new URL(path, trimmedBase).href;
}
