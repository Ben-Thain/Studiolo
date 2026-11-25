import "server-only";

import { getPublicEnv } from "@/lib/env";

const FALLBACK_BASE =
  "https://storage.studiolo.invalid/storage/v1/object/public/site-assets/";

/** Public object URL prefix for the site-assets bucket (server-only env read). */
export function siteAssetsPublicBase(): string {
  const url = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL.trim();
  if (!url) return FALLBACK_BASE;
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/site-assets/`;
}
