"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env";
import { AUTH_COPY } from "@/lib/auth/copy";
import { safeNext } from "@/lib/auth/next";
import { isGoogleEnabled } from "@/lib/auth/providers";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type AuthActionResult =
  { ok: true; email: string } | { ok: false; field?: "email"; message: string };

const emailSchema = z.email().max(254);

function callbackUrl(next: string | null | undefined): string {
  const url = new URL("/auth/callback", getPublicEnv().NEXT_PUBLIC_APP_URL);
  const safe = safeNext(next);
  if (safe) url.searchParams.set("next", safe);
  return url.toString();
}

function isRateLimited(error: { status?: number; code?: string }): boolean {
  return (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  );
}

/** Email magic link for both log in and sign up (a new address gets an account). */
export async function sendMagicLink(input: {
  email: string;
  next?: string | null;
}): Promise<AuthActionResult> {
  const parsed = emailSchema.safeParse(
    typeof input?.email === "string" ? input.email.trim() : "",
  );
  if (!parsed.success) {
    return { ok: false, field: "email", message: AUTH_COPY.invalidEmail };
  }
  const email = parsed.data.toLowerCase();
  if (!supabasePublicConfig()) {
    return { ok: false, message: AUTH_COPY.unavailable };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl(input.next),
        shouldCreateUser: true,
      },
    });
    if (error) {
      return {
        ok: false,
        message: isRateLimited(error)
          ? AUTH_COPY.rateLimited
          : AUTH_COPY.sendFailed,
      };
    }
  } catch {
    return { ok: false, message: AUTH_COPY.sendFailed };
  }
  return { ok: true, email };
}

/** Starts Google OAuth and redirects the browser to Google. */
export async function startGoogleSignIn(input: {
  next?: string | null;
}): Promise<AuthActionResult> {
  if (!supabasePublicConfig()) {
    return { ok: false, message: AUTH_COPY.unavailable };
  }
  if (!(await isGoogleEnabled())) {
    return { ok: false, message: AUTH_COPY.googleUnavailable };
  }
  let url: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl(input?.next),
        skipBrowserRedirect: true,
      },
    });
    if (!error) url = data.url;
  } catch {
    url = null;
  }
  if (!url) return { ok: false, message: AUTH_COPY.googleFailed };
  redirect(url);
}
