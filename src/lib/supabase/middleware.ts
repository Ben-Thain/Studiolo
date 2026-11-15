import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabasePublicConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session cookies for this request and returns the
 * signed-in user (or null). No UI and no service-role code: anon key only.
 */
/** Request header carrying the current path to server components. */
export const PATH_HEADER = "x-studiolo-path";

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  // Always overwritten here, so a client can't choose it; the guards still
  // pass it through safeNext.
  const headers = new Headers(request.headers);
  headers.set(
    PATH_HEADER,
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  let response = NextResponse.next({ request: { headers } });
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
        // Forward the refreshed cookies to this request's server render.
        headers.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers } });
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
