import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { authHref } from "@/lib/auth/next";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user, or null (also null when Supabase is not configured). */
export async function getUser(): Promise<User | null> {
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
}

/**
 * Server-side guard for auth routes, behind the middleware guard. Sends a
 * signed-out request to `/login?next=<path>`.
 */
export async function requireUser(path: string): Promise<User> {
  const user = await getUser();
  if (!user) redirect(authHref("/login", path));
  return user;
}
