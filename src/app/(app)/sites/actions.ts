"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { SITES_COPY } from "@/lib/sites/copy";
import { isValidSlug, withSuffix } from "@/lib/sites/slug";
import { starterChanges } from "@/lib/sites/starter";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * Site server actions (prompts 04a and 04b). Every action gets the user from
 * the session. Create runs as the user (RLS); duplicate checks ownership as
 * the user, then copies with the service role.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SlugCheck =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "reserved" }
  | { status: "taken"; suggestion: string | null };

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function slugIsFree(supabase: Supabase, slug: string, owner: string) {
  const { data, error } = await supabase.rpc("slug_is_free", {
    s: slug,
    for_owner: owner,
  });
  if (error) throw new Error("Could not check that address.");
  return data === true;
}

async function checkSlugAs(
  supabase: Supabase,
  owner: string,
  slug: string,
): Promise<SlugCheck> {
  if (!isValidSlug(slug)) return { status: "invalid" };
  const { data: reserved, error } = await supabase
    .from("reserved_slugs")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Could not check that address.");
  if (reserved) return { status: "reserved" };
  if (await slugIsFree(supabase, slug, owner)) return { status: "ok" };
  // First free suffix: -2, -3, … (a few tries; the user can still type one).
  for (let n = 2; n <= 20; n += 1) {
    const candidate = withSuffix(slug, n);
    if (await slugIsFree(supabase, candidate, owner)) {
      return { status: "taken", suggestion: candidate };
    }
  }
  return { status: "taken", suggestion: null };
}

/** The New site slug check (debounced by the form). */
export async function checkSlug(slug: string): Promise<SlugCheck> {
  const user = await requireUser();
  const supabase = await createClient();
  return checkSlugAs(supabase, user.id, String(slug));
}

export type CreateSiteResult =
  | { ok: true; siteId: string; homePageId: string }
  | {
      ok: false;
      field: "name" | "slug" | "form";
      error: string;
      suggestion?: string | null;
    };

const nameSchema = z
  .string()
  .trim()
  .min(1, SITES_COPY.nameRequired)
  .max(60, SITES_COPY.nameTooLong);

function slugError(check: SlugCheck): CreateSiteResult | null {
  if (check.status === "invalid") {
    return { ok: false, field: "slug", error: SITES_COPY.slugInvalid };
  }
  if (check.status === "reserved") {
    return { ok: false, field: "slug", error: SITES_COPY.slugReserved };
  }
  if (check.status === "taken") {
    return {
      ok: false,
      field: "slug",
      error: SITES_COPY.slugTaken,
      suggestion: check.suggestion,
    };
  }
  return null;
}

/**
 * Creates a Draft site with the starter pages and content. The client then
 * opens /sites/<id>/editor/<homeId>.
 */
export async function createSite(input: {
  name: string;
  slug: string;
}): Promise<CreateSiteResult> {
  const user = await requireUser();
  const parsedName = nameSchema.safeParse(input?.name ?? "");
  if (!parsedName.success) {
    return {
      ok: false,
      field: "name",
      error: parsedName.error.issues[0]?.message ?? SITES_COPY.nameRequired,
    };
  }
  const name = parsedName.data;
  const slug = String(input?.slug ?? "");
  const supabase = await createClient();

  try {
    const problem = slugError(await checkSlugAs(supabase, user.id, slug));
    if (problem) return problem;
  } catch {
    return { ok: false, field: "form", error: SITES_COPY.createFailed };
  }

  const siteId = crypto.randomUUID();
  const { error: insertError } = await supabase
    .from("sites")
    .insert({ id: siteId, owner_id: user.id, name, slug });
  if (insertError) {
    // Lost a race for the address between the check and the insert.
    if (insertError.code === "23505" || insertError.code === "ST001") {
      const check = await checkSlugAs(supabase, user.id, slug).catch(
        () => ({ status: "taken", suggestion: null }) as const,
      );
      return (
        slugError(check) ?? {
          ok: false,
          field: "slug",
          error: SITES_COPY.slugTaken,
        }
      );
    }
    if (insertError.code === "ST003") {
      return { ok: false, field: "slug", error: SITES_COPY.slugReserved };
    }
    return { ok: false, field: "form", error: SITES_COPY.createFailed };
  }

  const { changes, homePageId } = starterChanges(name);
  const { error: draftError } = await supabase.rpc("save_draft", {
    site: siteId,
    expected_revision: 0,
    changes: changes as unknown as Json,
  });
  if (draftError) {
    // Owners cannot delete sites (soft delete only), so the half-made site
    // is removed with the service role. It was created just above by this
    // user, so ownership is already known.
    try {
      await createAdminClient()
        .from("sites")
        .delete()
        .eq("id", siteId)
        .eq("owner_id", user.id);
    } catch {
      // Left as an empty draft; the owner can still open or delete it.
    }
    return { ok: false, field: "form", error: SITES_COPY.createFailed };
  }

  revalidatePath("/sites");
  return { ok: true, siteId, homePageId };
}

export type DuplicateSiteResult =
  { ok: true; siteId: string; message: string } | { ok: false; error: string };

const BUCKET = "site-assets";

/**
 * Duplicate (d-sites-duplicated.png): the database copy runs in one
 * transaction (duplicate_site), then the draft storage objects are copied.
 * If any copy fails, the half-made site and its copied objects are removed.
 */
export async function duplicateSite(
  siteId: string,
): Promise<DuplicateSiteResult> {
  const user = await requireUser();
  if (!UUID.test(String(siteId))) {
    return { ok: false, error: SITES_COPY.siteGone };
  }
  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", siteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (sourceError) {
    return { ok: false, error: SITES_COPY.duplicateFailed("this site") };
  }
  if (!source) return { ok: false, error: SITES_COPY.siteGone };
  const failed = SITES_COPY.duplicateFailed(source.name);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: failed };
  }

  const { data: copies, error: copyError } = await admin.rpc("duplicate_site", {
    p_site: siteId,
    p_owner: user.id,
  });
  const copy = copies?.[0];
  if (copyError || !copy) return { ok: false, error: failed };

  const bucket = admin.storage.from(BUCKET);
  const renamed = new Map(
    ((copy.asset_paths ?? []) as { from: string; to: string }[]).map((p) => [
      p.from,
      p.to,
    ]),
  );
  const copied: string[] = [];

  async function undo() {
    if (copied.length) await bucket.remove(copied);
    await admin.from("sites").delete().eq("id", copy!.id);
  }

  try {
    const prefix = `${siteId}/draft`;
    for (let offset = 0; ; offset += 1000) {
      const { data: objects, error: listError } = await bucket.list(prefix, {
        limit: 1000,
        offset,
      });
      if (listError) throw listError;
      for (const object of objects) {
        if (object.id === null) continue; // a folder
        const from = `${prefix}/${object.name}`;
        const to = renamed.get(from) ?? `${copy.id}/draft/${object.name}`;
        const { error } = await bucket.copy(from, to);
        if (error) throw error;
        copied.push(to);
      }
      if (objects.length < 1000) break;
    }
  } catch {
    await undo().catch(() => undefined);
    return { ok: false, error: failed };
  }

  revalidatePath("/sites");
  return {
    ok: true,
    siteId: copy.id,
    message: SITES_COPY.duplicated(source.name),
  };
}
