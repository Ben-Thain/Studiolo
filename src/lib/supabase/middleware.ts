import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabasePublicConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session cookies for this request and returns the
 * signed-in user (or null). No UI and no service-role code: anon key only.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });
  const config = supabasePublicConfig();
  if (!config) return { response, user: null };

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { response, user };
  } catch {
    return { response, user: null };
  }
}

/** A redirect that keeps any refreshed session cookies. */
export function redirectKeepingCookies(
  from: NextResponse,
  url: URL,
): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
