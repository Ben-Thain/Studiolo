import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import {
  addressUrl,
  canonicalAddress,
  studioloAddress,
  type SiteDomain,
} from "@/lib/addresses";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SITE_OWNER_SELECT } from "@/types/database";

/**
 * Reads for the site areas (prompt 04a). All run as the signed-in user
 * through RLS. A site that doesn't exist, is soft-deleted or belongs to
 * someone else is the app 404, never 403.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID.test(value);

export type SiteSummary = {
  id: string;
  name: string;
  slug: string;
  status: "live" | "draft";
  passwordOn: boolean;
  slugLocked: boolean;
  /** Studiolo address, e.g. riverton-house.studiolo.page */
  studioloAddress: string;
  /** Connected custom domain, else the Studiolo address. */
  address: string;
  url: string;
  domain: SiteDomain;
};

type SiteRow = {
  id: string;
  name: string;
  slug: string;
  live_publish_id: string | null;
  password_enabled: boolean;
  slug_locked_at: string | null;
};

/** One of the user's own non-deleted sites, once per request, or 404. */
export const getSite = cache(async (siteId: string): Promise<SiteSummary> => {
  await requireUser();
  if (!isUuid(siteId)) notFound();
  const supabase = await createClient();
  const { data: site, error } = await supabase
    .from("sites")
    .select(SITE_OWNER_SELECT)
    .eq("id", siteId)
    .is("deleted_at", null)
    .returns<SiteRow[]>()
    .maybeSingle();
  if (error) throw new Error("Could not load this site.");
  if (!site) notFound();
  const { data: domainRow, error: domainError } = await supabase
    .from("domains")
    .select("hostname, status")
    .eq("site_id", siteId)
    .maybeSingle();
  if (domainError) throw new Error("Could not load this site.");
  const domain: SiteDomain = domainRow
    ? { hostname: domainRow.hostname, status: domainRow.status }
    : null;
  const address = canonicalAddress(site, domain);
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    status: site.live_publish_id ? "live" : "draft",
    passwordOn: site.password_enabled,
    slugLocked: site.slug_locked_at !== null,
    studioloAddress: studioloAddress(site.slug),
    address,
    url: addressUrl(address),
    domain,
  };
});

export type SitePage = {
  id: string;
  title: string;
  slug: string;
  isHome: boolean;
  inNav: boolean;
};

/** The site's pages in menu order. */
export const getSitePages = cache(
  async (siteId: string): Promise<SitePage[]> => {
    await getSite(siteId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pages")
      .select("id, title, slug, is_home, in_nav, sort_order")
      .eq("site_id", siteId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error("Could not load this site.");
    return data.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      isHome: page.is_home,
      inNav: page.in_nav,
    }));
  },
);

/** The home page, or the first page if a site somehow has no home. */
export function homePageOf(pages: SitePage[]): SitePage | undefined {
  return pages.find((page) => page.isHome) ?? pages[0];
}

/** A page of this site, or 404. */
export async function requireSitePage(
  siteId: string,
  pageId: string,
): Promise<SitePage> {
  if (!isUuid(pageId)) notFound();
  const page = (await getSitePages(siteId)).find((p) => p.id === pageId);
  if (!page) notFound();
  return page;
}

/** The public path of a page: "/" for home, else "/<slug>". */
export function pagePath(page: SitePage): string {
  return page.isHome ? "/" : `/${page.slug}`;
}

export type CanvasLayout = {
  col: number;
  span: number;
  row: number;
  rows: number;
  hidden: boolean;
};

export type CanvasElement = {
  id: string;
  type: "text" | "image" | "nav" | "form";
  name: string;
  content: Record<string, unknown>;
  sortOrder: number;
  desktop: CanvasLayout | null;
  mobile: CanvasLayout | null;
};

export type CanvasSection = {
  id: string;
  name: string;
  siteWide: boolean;
  elements: CanvasElement[];
};

/**
 * The draft of one page for the editor placeholder: the site-wide sections
 * first, then the page's own, each with its elements and both layouts.
 */
export async function getPageCanvas(
  siteId: string,
  pageId: string,
): Promise<CanvasSection[]> {
  const supabase = await createClient();
  const [sections, elements] = await Promise.all([
    supabase
      .from("sections")
      .select("id, page_id, name, sort_order")
      .eq("site_id", siteId)
      .or(`page_id.is.null,page_id.eq.${pageId}`)
      .order("sort_order", { ascending: true }),
    supabase
      .from("elements")
      .select(
        "id, section_id, type, name, content, sort_order, element_layouts (breakpoint, col_start, col_span, row_start, row_span, hidden)",
      )
      .eq("site_id", siteId)
      .or(`page_id.is.null,page_id.eq.${pageId}`)
      .order("sort_order", { ascending: true }),
  ]);
  if (sections.error || elements.error) {
    throw new Error("Could not load this page.");
  }
  const layout = (
    rows: {
      breakpoint: string;
      col_start: number;
      col_span: number;
      row_start: number;
      row_span: number;
      hidden: boolean;
    }[],
    breakpoint: "desktop" | "mobile",
  ): CanvasLayout | null => {
    const row = rows.find((r) => r.breakpoint === breakpoint);
    return row
      ? {
          col: row.col_start,
          span: row.col_span,
          row: row.row_start,
          rows: row.row_span,
          hidden: row.hidden,
        }
      : null;
  };
  return [...sections.data]
    .sort(
      (a, b) =>
        Number(a.page_id !== null) - Number(b.page_id !== null) ||
        a.sort_order - b.sort_order,
    )
    .map((section) => ({
      id: section.id,
      name: section.name,
      siteWide: section.page_id === null,
      elements: elements.data
        .filter((e) => e.section_id === section.id)
        .map((e) => ({
          id: e.id,
          type: e.type as CanvasElement["type"],
          name: e.name,
          content: (e.content ?? {}) as Record<string, unknown>,
          sortOrder: e.sort_order,
          desktop: layout(e.element_layouts ?? [], "desktop"),
          mobile: layout(e.element_layouts ?? [], "mobile"),
        })),
    }));
}
