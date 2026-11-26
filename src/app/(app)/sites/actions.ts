"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { studioloAddress } from "@/lib/addresses";
import { requireUser } from "@/lib/auth/session";
import { SITES_COPY } from "@/lib/sites/copy";
import { detachSiteDomain, invalidateSiteCaches } from "@/lib/sites/hooks";
import { isValidSlug } from "@/lib/sites/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { instantiateTemplate } from "@/templates/instantiate";
import { isTemplateId, loadTemplate } from "@/templates/index";
import type { Json } from "@/types/database";

/**
 * Site server actions (prompts 04a and 04b). Every action gets the user from
 * the session. Create runs as the user (RLS); duplicate checks ownership as
 * the user, then copies with the service role. The slug check is rate
 * limited per user (60 a minute).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SlugCheck =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "reserved" }
  | { status: "taken"; suggestion: string | null }
  | { status: "rate_limited" };

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
  // First free suffix -2 … -20, in one query (first_free_slug, 0007).
  const { data: suggestion, error: suggestionError } = await supabase.rpc(
    "first_free_slug",
    { s: slug, for_owner: owner },
  );
  if (suggestionError) throw new Error("Could not check that address.");
  return { status: "taken", suggestion: suggestion ?? null };
}

/** Slug checks per user per minute (rate_limit_hit, service role only). */
const SLUG_CHECKS_PER_MINUTE = 60;

async function slugCheckAllowed(owner: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      b: `slug:${owner}`,
      window_seconds: 60,
      max: SLUG_CHECKS_PER_MINUTE,
    });
    return !error && data === true;
  } catch {
    // No service role (or the limiter failed): hold the check rather than
    // run unmetered lookups. Create site still checks the address itself.
    return false;
  }
}

/** The New site slug check (debounced by the form). */
export async function checkSlug(slug: string): Promise<SlugCheck> {
  const user = await requireUser();
  const value = String(slug);
  // A malformed address costs no database call and no rate-limit hit.
  if (!isValidSlug(value)) return { status: "invalid" };
  if (!(await slugCheckAllowed(user.id))) return { status: "rate_limited" };
  const supabase = await createClient();
  return checkSlugAs(supabase, user.id, value);
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
  if (check.status === "rate_limited") return null;
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

const BUCKET = "site-assets";

async function removeUploaded(paths: string[]) {
  if (paths.length === 0) return;
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove(paths);
}

/**
 * Creates a Draft site from a Studiolo original (or Start blank). Photos are
 * uploaded first; the site, asset rows and content are one transaction.
 * A failure removes the objects already uploaded and leaves no site.
 */
export async function createSite(input: {
  name: string;
  slug: string;
  templateId?: string;
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
  const templateId = input?.templateId || "blank";
  if (!isTemplateId(templateId)) {
    return { ok: false, field: "form", error: SITES_COPY.createFailed };
  }
  const supabase = await createClient();

  try {
    const problem = slugError(await checkSlugAs(supabase, user.id, slug));
    if (problem) return problem;
  } catch {
    return { ok: false, field: "form", error: SITES_COPY.createFailed };
  }

  const template = loadTemplate(templateId);
  const siteId = crypto.randomUUID();
  const instantiated = instantiateTemplate(template, {
    siteId,
    siteName: name,
  });
  const uploaded: string[] = [];
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, field: "form", error: SITES_COPY.createFailed };
  }

  try {
    let cursor = 0;
    const queue = instantiated.uploads;
    async function worker() {
      while (cursor < queue.length) {
        const item = queue[cursor];
        cursor += 1;
        if (!item) return;
        const filePath = path.join(
          process.cwd(),
          "public",
          "templates",
          templateId,
          item.file,
        );
        const bytes = await readFile(filePath);
        const objectPath = `${siteId}/draft/${item.assetId}.webp`;
        const { error } = await admin.storage
          .from(BUCKET)
          .upload(objectPath, bytes, {
            contentType: "image/webp",
            upsert: false,
          });
        if (error) throw error;
        uploaded.push(objectPath);
      }
    }
    const workers = await Promise.allSettled(
      Array.from({ length: Math.min(4, Math.max(queue.length, 1)) }, () =>
        worker(),
      ),
    );
    if (
      queue.length > 0 &&
      (workers.some((result) => result.status === "rejected") ||
        uploaded.length !== queue.length)
    ) {
      await removeUploaded(uploaded);
      return { ok: false, field: "form", error: SITES_COPY.createFailed };
    }

    const { error: createError } = await admin.rpc("create_site", {
      p_owner: user.id,
      p_site: siteId,
      p_name: name,
      p_slug: slug,
      p_template_id: template.id,
      p_template_version: template.version,
      p_assets: instantiated.assets.map((asset) => ({
        id: asset.id,
        path: asset.path,
        width: asset.width,
        height: asset.height,
        mime: asset.mime,
        bytes: asset.bytes,
        blur_data_url: asset.blurDataUrl,
      })) as unknown as Json,
      p_changes: instantiated.changes as unknown as Json,
    });
    if (createError) {
      await removeUploaded(uploaded);
      const code = createError.code;
      if (code === "23505" || code === "ST001") {
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
      if (code === "ST003") {
        return { ok: false, field: "slug", error: SITES_COPY.slugReserved };
      }
      return { ok: false, field: "form", error: SITES_COPY.createFailed };
    }
  } catch {
    await removeUploaded(uploaded).catch(() => undefined);
    return { ok: false, field: "form", error: SITES_COPY.createFailed };
  }

  revalidatePath("/sites");
  return { ok: true, siteId, homePageId: instantiated.homePageId };
}

export type DuplicateSiteResult =
  { ok: true; siteId: string; message: string } | { ok: false; error: string };

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
    // Every asset row's object first, by name: a missing or failed copy
    // undoes the duplicate (the copy must not point at files it lacks).
    for (const [from, to] of renamed) {
      const { error } = await bucket.copy(from, to);
      if (error) throw error;
      copied.push(to);
    }
    // Then any other draft object (not in an asset row), found by listing.
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
        if (renamed.has(from)) continue; // copied above
        const to = `${copy.id}/draft/${object.name}`;
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

export type DeleteSiteResult =
  { ok: true; siteId: string; name: string } | { ok: false; error: string };

export type RestoreSiteResult =
  | {
      ok: true;
      siteId: string;
      name: string;
      slug?: string;
      slugChanged?: boolean;
      address?: string;
      alreadyActive?: boolean;
    }
  | { ok: false; error: string; expired?: boolean };

function logHookError(phase: string, siteId: string, error: unknown) {
  console.error(`[sites] ${phase} hook failed for ${siteId}`, error);
}

/**
 * Soft-deletes a site (service role after an ownership check): offline at once,
 * kept for 30 days, custom domain detached.
 */
export async function deleteSite(siteId: string): Promise<DeleteSiteResult> {
  const user = await requireUser();
  if (!UUID.test(String(siteId))) {
    return { ok: false, error: SITES_COPY.siteGone };
  }
  const supabase = await createClient();
  const { data: site, error: readError } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", siteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) return { ok: false, error: SITES_COPY.deleteFailed };
  if (!site) return { ok: false, error: SITES_COPY.siteGone };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: SITES_COPY.deleteFailed };
  }

  const { data: deleted, error: deleteError } = await admin.rpc(
    "soft_delete_site",
    { p_site: siteId, p_owner: user.id },
  );
  const row = deleted?.[0];
  if (deleteError || !row?.site_name) {
    if (deleteError?.code === "ST001") {
      return { ok: false, error: SITES_COPY.siteGone };
    }
    return { ok: false, error: SITES_COPY.deleteFailed };
  }

  try {
    // prompt 11 TODO: detach the custom domain from the Vercel project.
    await detachSiteDomain(siteId);
  } catch (error) {
    logHookError("detachSiteDomain", siteId, error);
  }
  try {
    await invalidateSiteCaches(siteId);
  } catch (error) {
    logHookError("invalidateSiteCaches", siteId, error);
  }

  revalidatePath("/sites");
  revalidatePath("/sites/deleted");
  return { ok: true, siteId, name: row.site_name };
}

/**
 * Restores a soft-deleted site as a Draft (service role). Used by Undo, Restore
 * and prompt 08 Settings → Delete site undo paths.
 */
export async function restoreSite(siteId: string): Promise<RestoreSiteResult> {
  const user = await requireUser();
  if (!UUID.test(String(siteId))) {
    return { ok: false, error: SITES_COPY.siteGone };
  }
  const supabase = await createClient();
  const { data: site, error: readError } = await supabase
    .from("sites")
    .select("id, name, slug, deleted_at, purge_after")
    .eq("id", siteId)
    .maybeSingle();
  if (readError) return { ok: false, error: SITES_COPY.restoreFailed };
  if (!site) {
    return {
      ok: false,
      error: SITES_COPY.restoreExpired,
      expired: true,
    };
  }
  if (!site.deleted_at) {
    return { ok: true, siteId, name: site.name, alreadyActive: true };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: SITES_COPY.restoreFailed };
  }

  const { data: restorable, error: restorableError } = await admin.rpc(
    "is_site_restorable",
    { p_site: siteId, p_owner: user.id },
  );
  if (restorableError) return { ok: false, error: SITES_COPY.restoreFailed };
  if (!restorable) {
    return {
      ok: false,
      error: SITES_COPY.restoreExpired,
      expired: true,
    };
  }

  const { data: rows, error: restoreError } = await admin.rpc("restore_site", {
    p_site: siteId,
    p_owner: user.id,
  });
  const row = rows?.[0];
  if (restoreError) {
    if (restoreError.code === "ST404") {
      return {
        ok: false,
        error: SITES_COPY.restoreExpired,
        expired: true,
      };
    }
    return { ok: false, error: SITES_COPY.restoreFailed };
  }
  if (!row) {
    return {
      ok: false,
      error: SITES_COPY.restoreExpired,
      expired: true,
    };
  }

  try {
    await invalidateSiteCaches(siteId);
  } catch (error) {
    logHookError("invalidateSiteCaches", siteId, error);
  }

  revalidatePath("/sites");
  revalidatePath("/sites/deleted");
  return {
    ok: true,
    siteId,
    name: site.name,
    slug: row.slug,
    slugChanged: row.slug_changed,
    address: studioloAddress(row.slug),
  };
}
