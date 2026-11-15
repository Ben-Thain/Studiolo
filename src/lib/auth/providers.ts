import "server-only";

import { supabasePublicConfig } from "@/lib/supabase/config";

type Cached = { google: boolean; at: number };
let cached: Cached | null = null;

// Production caches the answer for a minute; development always asks, so a
// provider switched on in the dashboard shows up on the next load.
const TTL_MS = process.env.NODE_ENV === "production" ? 60_000 : 0;

/**
 * Whether Google sign-in is enabled on the Supabase project, read from the
 * public Auth settings endpoint (`/auth/v1/settings`, anon key). With the
 * provider off, Supabase answers the authorize redirect with a raw JSON
 * error, so the UI shows "Google sign-in isn't set up yet" instead.
 * Unreachable settings count as enabled: a network blip should not hide it.
 */
export async function isGoogleEnabled(): Promise<boolean> {
  const config = supabasePublicConfig();
  if (!config) return false;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.google;
  try {
    const response = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return true;
    const body = (await response.json()) as {
      external?: { google?: unknown };
    };
    const google = body.external?.google === true;
    cached = { google, at: Date.now() };
    return google;
  } catch {
    return true;
  }
}
