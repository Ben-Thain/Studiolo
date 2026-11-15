import "server-only";

import { cache } from "react";
import { addressUrl, canonicalAddress, type SiteDomain } from "@/lib/addresses";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { trialLineText } from "@/lib/trial";
import { SITE_OWNER_SELECT } from "@/types/database";

/**
 * Reads for the home shell (prompt 03). Every read runs as the signed-in user
 * through RLS; nothing here uses the service role.
 */

export type HomeProfile = {
  display_name: string;
  notification_email: string | null;
  trial_started_at: string;
};

export type HomeContext = {
  userId: string;
  email: string;
  /** Set while a login email change waits for confirmation. */
  newEmail: string | null;
  profile: HomeProfile;
};

/** The user and their profile, once per request. */
export const getHomeContext = cache(async (): Promise<HomeContext> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, notification_email, trial_started_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Could not load your profile.");
  }
  return {
    userId: user.id,
    email: user.email ?? "",
    newEmail: user.new_email ?? null,
    profile: data,
  };
});

function initialsOf(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}

/** The sidebar footer of both shells: trial line and account row. */
export async function getAccountLine(): Promise<{
  trialText: string;
  initials: string;
  name: string;
}> {
  const { email, profile } = await getHomeContext();
  return {
    trialText: trialLineText(profile),
    initials: initialsOf(profile.display_name, email),
    name: profile.display_name.trim() || email,
  };
}

export type SiteListItem = {
  id: string;
  name: string;
  status: "live" | "draft";
  passwordOn: boolean;
  address: string;
  /** The canonical address as a URL, for View live. */
  url: string;
  lastEditedAt: string;
};

/** The user's sites, not deleted, most recently edited first. */
export async function listSites(): Promise<SiteListItem[]> {
  await requireUser();
  const supabase = await createClient();
  const { data: sites, error } = await supabase
    .from("sites")
    .select(SITE_OWNER_SELECT)
    .is("deleted_at", null)
    .order("draft_updated_at", { ascending: false })
    .returns<
      {
        id: string;
        name: string;
        slug: string;
        live_publish_id: string | null;
        password_enabled: boolean;
        draft_updated_at: string;
      }[]
    >();
  if (error) throw new Error("Could not load your sites.");
  if (!sites.length) return [];

  const { data: domains, error: domainError } = await supabase
    .from("domains")
    .select("site_id, hostname, status")
    .in(
      "site_id",
      sites.map((site) => site.id),
    );
  if (domainError) throw new Error("Could not load your sites.");
  const bySite = new Map<string, SiteDomain>(
    domains.map((d) => [d.site_id, { hostname: d.hostname, status: d.status }]),
  );

  return sites.map((site) => {
    const address = canonicalAddress(site, bySite.get(site.id));
    return {
      id: site.id,
      name: site.name,
      status: site.live_publish_id ? "live" : "draft",
      passwordOn: site.password_enabled,
      address,
      url: addressUrl(address),
      lastEditedAt: site.draft_updated_at,
    };
  });
}

/** How many sites the user has (not deleted), for the Delete account copy. */
export async function countSites(): Promise<number> {
  await requireUser();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("sites")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (error) throw new Error("Could not load your sites.");
  return count ?? 0;
}
