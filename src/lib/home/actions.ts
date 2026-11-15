"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env";
import { getUser } from "@/lib/auth/session";
import { ACCOUNT_COPY } from "@/lib/home/copy";
import { createClient } from "@/lib/supabase/server";

/**
 * Account page writes (prompt 03), all as the signed-in user: RLS and the
 * column grants allow only display_name and notification_email on their own
 * profile. The login email goes through Supabase's confirm flow.
 */

export type AccountResult =
  { ok: true; value: string } | { ok: false; message: string };

const nameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, ACCOUNT_COPY.nameRequired)
      .max(80, ACCOUNT_COPY.nameTooLong),
  );

const emailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email(ACCOUNT_COPY.invalidEmail).max(254, ACCOUNT_COPY.invalidEmail));

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? ACCOUNT_COPY.saveFailed;
}

async function signedIn() {
  const user = await getUser();
  if (!user) redirect("/login?next=%2Faccount");
  return { user, supabase: await createClient() };
}

export async function updateDisplayName(input: {
  name: string;
}): Promise<AccountResult> {
  const parsed = nameSchema.safeParse(
    typeof input?.name === "string" ? input.name : "",
  );
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { user, supabase } = await signedIn();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data })
    .eq("id", user.id);
  if (error) return { ok: false, message: ACCOUNT_COPY.saveFailed };
  revalidatePath("/", "layout");
  return { ok: true, value: parsed.data };
}

/** Empty clears it: form notifications then go to the login email. */
export async function updateNotificationEmail(input: {
  email: string;
}): Promise<AccountResult> {
  const raw = typeof input?.email === "string" ? input.email.trim() : "";
  let value: string | null = null;
  if (raw !== "") {
    const parsed = emailSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: firstIssue(parsed.error) };
    }
    value = parsed.data;
  }
  const { user, supabase } = await signedIn();
  const { error } = await supabase
    .from("profiles")
    .update({ notification_email: value })
    .eq("id", user.id);
  if (error) return { ok: false, message: ACCOUNT_COPY.saveFailed };
  revalidatePath("/account");
  return { ok: true, value: value ?? "" };
}

/**
 * Starts Supabase's email change: with secure email change on (the default),
 * both the old and the new address get a confirmation link, and the login
 * email changes only once both are confirmed.
 */
export async function changeLoginEmail(input: {
  email: string;
}): Promise<AccountResult> {
  const parsed = emailSchema.safeParse(
    typeof input?.email === "string" ? input.email : "",
  );
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { user, supabase } = await signedIn();
  if (parsed.data === (user.email ?? "").toLowerCase()) {
    return { ok: false, message: ACCOUNT_COPY.sameEmail };
  }
  const redirectTo = new URL(
    "/auth/callback",
    getPublicEnv().NEXT_PUBLIC_APP_URL,
  );
  redirectTo.searchParams.set("next", "/account");
  try {
    const { error } = await supabase.auth.updateUser(
      { email: parsed.data },
      { emailRedirectTo: redirectTo.toString() },
    );
    if (error) {
      if (error.status === 429 || error.code === "over_email_send_rate_limit") {
        return { ok: false, message: ACCOUNT_COPY.rateLimited };
      }
      if (error.code === "email_exists" || error.status === 422) {
        return { ok: false, message: ACCOUNT_COPY.emailUnavailable };
      }
      if (error.code === "validation_failed" || error.status === 400) {
        return { ok: false, message: ACCOUNT_COPY.invalidEmail };
      }
      return { ok: false, message: ACCOUNT_COPY.saveFailed };
    }
  } catch {
    return { ok: false, message: ACCOUNT_COPY.saveFailed };
  }
  revalidatePath("/account");
  return { ok: true, value: parsed.data };
}

export async function signOut(): Promise<{ ok: false; message: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, message: ACCOUNT_COPY.signOutFailed };
  } catch {
    return { ok: false, message: ACCOUNT_COPY.signOutFailed };
  }
  redirect("/");
}
