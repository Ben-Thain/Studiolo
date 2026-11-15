import { getPublicEnv, type PublicEnv } from "@/lib/env";

/**
 * Site addresses, shown without a scheme (prompt 04 names this module; the
 * Sites list in prompt 03 is its first user).
 */

type AddressEnv = Pick<
  PublicEnv,
  | "NEXT_PUBLIC_APP_URL"
  | "NEXT_PUBLIC_ROOT_DOMAIN"
  | "NEXT_PUBLIC_WILDCARD_READY"
>;

/** `<slug>.<root>` once the wildcard is attached, else `<app host>/s/<slug>`. */
export function studioloAddress(
  slug: string,
  env: AddressEnv = getPublicEnv(),
): string {
  if (env.NEXT_PUBLIC_WILDCARD_READY === "1") {
    return `${slug}.${env.NEXT_PUBLIC_ROOT_DOMAIN}`;
  }
  return `${new URL(env.NEXT_PUBLIC_APP_URL).host}/s/${slug}`;
}

export type SiteDomain = { hostname: string; status: string } | null;

/** The connected custom domain, else the Studiolo address. */
export function canonicalAddress(
  site: { slug: string },
  domain: SiteDomain | undefined,
  env: AddressEnv = getPublicEnv(),
): string {
  if (domain && domain.status === "connected") return domain.hostname;
  return studioloAddress(site.slug, env);
}
