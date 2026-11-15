import { getPublicEnv } from "@/lib/env";

/** The public Supabase URL and anon key, or null when they are not set. */
export function supabasePublicConfig(): {
  url: string;
  anonKey: string;
} | null {
  const env = getPublicEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
