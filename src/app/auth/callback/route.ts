import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/auth/next";
import { getPublicEnv } from "@/lib/env";
import { HOME_ROUTE, isAppHost } from "@/lib/auth/routes";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "magiclink",
  "signup",
  "email",
  "invite",
  "recovery",
  "email_change",
];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

/**
 * Magic-link and Google return. Exchanges the PKCE code (or verifies a token
 * hash) with @supabase/ssr, then sends the user to a validated `next` or
 * `/sites`. Any failure lands on `/auth/expired`; raw auth errors are never
 * shown.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Redirect on the app host that received the request, since the session
  // cookies are set there. request.url can be normalised to localhost by the
  // dev server, so read the Host header, and fall back to the app URL when the
  // header is not an app host.
  const env = getPublicEnv();
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const origin = isAppHost(host, {
    appUrl: env.NEXT_PUBLIC_APP_URL,
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
  })
    ? `${forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : request.nextUrl.protocol.replace(":", "")}://${host}`
    : new URL(env.NEXT_PUBLIC_APP_URL).origin;
  const at = (path: string) => new URL(path, origin);
  const next = safeNext(searchParams.get("next")) ?? HOME_ROUTE;
  const expired = at("/auth/expired");
  const nextParam = safeNext(searchParams.get("next"));
  if (nextParam) expired.searchParams.set("next", nextParam);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (searchParams.get("error") || !supabasePublicConfig()) {
    return NextResponse.redirect(expired);
  }

  try {
    const supabase = await createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(at(next));
    } else if (tokenHash && isOtpType(type)) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
      if (!error) return NextResponse.redirect(at(next));
    }
  } catch {
    // Fall through to the expired page.
  }
  return NextResponse.redirect(expired);
}
