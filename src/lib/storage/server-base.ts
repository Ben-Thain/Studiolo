import "server-only";

import { getPublicEnv } from "@/lib/env";

/** Public object URL prefix, or null when Supabase is not configured. */
export function siteAssetsPublicBase(): string | null {
  const url = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL.trim();
  if (!url) return null;
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/site-assets/`;
}
