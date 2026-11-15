import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { User } from "@supabase/supabase-js";
import { authHref } from "@/lib/auth/next";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { PATH_HEADER } from "@/lib/supabase/middleware";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user, or null (also null when Supabase is not configured).
 * Cached per request, so a layout and its page share one Auth call.
 */
export const getUser = cache(async function getUser(): Promise<User | null> {
  // Always per request: without this, a build with no Supabase env would
  // prerender guarded pages as a fixed redirect.
  await connection();
  if (!supabasePublicConfig()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});

/** The current path, as set by the middleware (`/sites` if missing). */
export async function currentPath(): Promise<string> {
  return (await headers()).get(PATH_HEADER) ?? "/sites";
}

/**
 * Server-side guard for auth routes, behind the middleware guard. Sends a
 * signed-out request to `/login?next=<current path>`.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect(authHref("/login", await currentPath()));
  return user;
}
