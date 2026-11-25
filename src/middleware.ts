import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import {
  HOME_ROUTE,
  isAppHost,
  isAppRoute,
  isAuthRoute,
} from "@/lib/auth/routes";
import {
  redirectKeepingCookies,
  updateSession,
} from "@/lib/supabase/middleware";

// Prompt 03: session refresh and auth guards on app hosts and app routes only.
// Prompt 09 adds tenant-host routing here. Stays middleware.ts so later prompts
// extend the same module; Next.js 16 prints a deprecation notice pointing at
// proxy.ts, and this file still runs. It lives in src/ because the app uses
// src/app: a root middleware.ts is ignored in that layout (the stage-00 stub
// never ran). No UI and no service-role code here.
export async function middleware(request: NextRequest) {
  const env = getPublicEnv();
  const host = request.headers.get("host");
  if (
    !isAppHost(host, {
      appUrl: env.NEXT_PUBLIC_APP_URL,
      rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    })
  ) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  if (!isAppRoute(pathname)) return NextResponse.next();

  const { response, user } = await updateSession(request);

  if (!user && isAuthRoute(pathname)) {
    const nextAction = request.headers.get("next-action");
    if (nextAction?.trim()) {
      return response;
    }
    const login = new URL("/login", request.url);
    login.search = "";
    login.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingCookies(response, login);
  }

  if (user && pathname === "/") {
    const home = new URL(HOME_ROUTE, request.url);
    home.search = "";
    return redirectKeepingCookies(response, home);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|css|js|map|woff2?)$).*)",
  ],
};
