/**
 * Route map (prompt 03). Later prompts add routes; they never rename these.
 */

/** Signed-in only. `/sites/[siteId]/…` also needs ownership (prompt 04). */
export const AUTH_ROUTE_PREFIXES = ["/sites", "/account", "/plan"] as const;

/** Public app routes. */
export const PUBLIC_APP_ROUTES = ["/", "/login", "/signup"] as const;

/** Where a signed-in user lands by default. */
export const HOME_ROUTE = "/sites";

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/** App routes where the middleware refreshes the Supabase session. */
export function isAppRoute(pathname: string): boolean {
  return (
    (PUBLIC_APP_ROUTES as readonly string[]).includes(pathname) ||
    matchesPrefix(pathname, "/auth") ||
    isAuthRoute(pathname)
  );
}

function hostOnly(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function hostOf(url: string): string | null {
  try {
    return hostOnly(new URL(url).host);
  } catch {
    return null;
  }
}

/**
 * The app itself, as opposed to a tenant site (`<slug>.<root>` or a custom
 * domain, prompt 09): the host of NEXT_PUBLIC_APP_URL, the bare root domain,
 * local development hosts and Vercel preview URLs.
 */
export function isAppHost(
  host: string | null | undefined,
  env: { appUrl: string; rootDomain: string },
): boolean {
  if (!host) return false;
  const value = hostOnly(host);
  const name = value.replace(/:\d+$/, "");
  const app = hostOf(env.appUrl);
  if (app && value === app) return true;
  if (value === hostOnly(env.rootDomain)) return true;
  if (name === "localhost" || name === "127.0.0.1" || name === "[::1]") {
    return true;
  }
  return name.endsWith(".vercel.app");
}
