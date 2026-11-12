import "server-only";
import { z } from "zod";

/**
 * Server-only secrets. Importing this module from a client component fails
 * the build. Never read these keys from `src/lib/env.ts`.
 */

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  RESEND_API_KEY: z.string(),
  RESEND_FROM: z.string(),
  VERCEL_TOKEN: z.string(),
  VERCEL_PROJECT_ID: z.string(),
  VERCEL_TEAM_ID: z.string(),
  SITE_GATE_SECRET: z.string(),
  IP_HASH_SALT: z.string(),
  CRON_SECRET: z.string(),
  DOMAINS_DRY_RUN: z.enum(["", "1"]),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type ServerEnvSource = Record<string, string | undefined>;

function trimmed(source: ServerEnvSource, key: string): string {
  return source[key]?.trim() ?? "";
}

export function readServerEnv(
  source: ServerEnvSource = process.env,
): ServerEnv {
  const candidate = {
    SUPABASE_SERVICE_ROLE_KEY: trimmed(source, "SUPABASE_SERVICE_ROLE_KEY"),
    RESEND_API_KEY: trimmed(source, "RESEND_API_KEY"),
    RESEND_FROM: trimmed(source, "RESEND_FROM"),
    VERCEL_TOKEN: trimmed(source, "VERCEL_TOKEN"),
    VERCEL_PROJECT_ID: trimmed(source, "VERCEL_PROJECT_ID"),
    VERCEL_TEAM_ID: trimmed(source, "VERCEL_TEAM_ID"),
    SITE_GATE_SECRET: trimmed(source, "SITE_GATE_SECRET"),
    IP_HASH_SALT: trimmed(source, "IP_HASH_SALT"),
    CRON_SECRET: trimmed(source, "CRON_SECRET"),
    DOMAINS_DRY_RUN: trimmed(source, "DOMAINS_DRY_RUN"),
  };

  const parsed = serverEnvSchema.safeParse(candidate);
  if (!parsed.success) {
    const keys = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Invalid server environment: ${keys || "one or more server variables"}. Check docs/ENV.md. Values are not included in this message.`,
    );
  }

  return parsed.data;
}

export function getServerEnv(): ServerEnv {
  return readServerEnv(process.env);
}
