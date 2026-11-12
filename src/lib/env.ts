import { z } from "zod";

/**
 * Public environment variables only (`NEXT_PUBLIC_*`).
 * Server secrets are read from `src/lib/env.server.ts`, which imports
 * `server-only` and must never be imported by a client component.
 */

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_ROOT_DOMAIN: z
    .string()
    .min(1)
    .refine((value) => !value.includes("://") && !value.includes("/"), {
      message: "must be a bare host, without a protocol or path",
    }),
  NEXT_PUBLIC_SUPABASE_URL: z.union([z.literal(""), z.url()]),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  NEXT_PUBLIC_WILDCARD_READY: z.enum(["", "1"]),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Public vars that must be set when NODE_ENV is production. Supabase keys join this list in prompt 02. */
export const REQUIRED_PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_ROOT_DOMAIN",
] as const;

export type PublicEnvSource = Record<string, string | undefined>;

const DEV_DEFAULTS: Record<(typeof REQUIRED_PUBLIC_ENV_KEYS)[number], string> =
  {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000",
  };

function trimmed(source: PublicEnvSource, key: string): string {
  return source[key]?.trim() ?? "";
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export function readPublicEnv(
  source: PublicEnvSource = process.env,
): PublicEnv {
  const nodeEnv = source.NODE_ENV ?? process.env.NODE_ENV;
  const isProduction = nodeEnv === "production";

  const missing = REQUIRED_PUBLIC_ENV_KEYS.filter(
    (key) => trimmed(source, key) === "",
  );

  if (isProduction && missing.length > 0) {
    const noun = missing.length === 1 ? "variable" : "variables";
    throw new Error(
      `Missing required public environment ${noun}: ${missing.join(", ")}. Set ${missing.join(" and ")} before running Studiolo in production.`,
    );
  }

  const wildcard = trimmed(source, "NEXT_PUBLIC_WILDCARD_READY");
  const candidate = {
    NEXT_PUBLIC_APP_URL:
      trimmed(source, "NEXT_PUBLIC_APP_URL") ||
      (isProduction ? "" : DEV_DEFAULTS.NEXT_PUBLIC_APP_URL),
    NEXT_PUBLIC_ROOT_DOMAIN:
      trimmed(source, "NEXT_PUBLIC_ROOT_DOMAIN") ||
      (isProduction ? "" : DEV_DEFAULTS.NEXT_PUBLIC_ROOT_DOMAIN),
    NEXT_PUBLIC_SUPABASE_URL: trimmed(source, "NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: trimmed(
      source,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
    NEXT_PUBLIC_WILDCARD_READY: wildcard,
  };

  const parsed = publicEnvSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment: ${formatIssues(parsed.error)}`,
    );
  }

  return parsed.data;
}

export function getPublicEnv(): PublicEnv {
  return readPublicEnv(process.env);
}
