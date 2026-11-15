import type { Metadata } from "next";
import { CanvasPreview } from "@/components/sites/canvas-preview";
import { RememberLastPage } from "@/components/sites/editor-href";
import {
  getPageCanvas,
  getSite,
  getSitePages,
  requireSitePage,
} from "@/lib/sites/data";

export const metadata: Metadata = { title: "Editor · Studiolo" };

// The Editor route. Prompt 06 builds the editor UI; until then this shows
// the page's draft read-only inside the real site shell.
export default async function EditorPage({
  params,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
}) {
  const { siteId, pageId } = await params;
  const site = await getSite(siteId);
  const page = await requireSitePage(siteId, pageId);
  const [sections, pages] = await Promise.all([
    getPageCanvas(siteId, page.id),
    getSitePages(siteId),
  ]);
  return (
    <>
      <RememberLastPage siteId={siteId} pageId={page.id} />
      <h1 className="sr-only">
        {site.name}: {page.title}
      </h1>
      <CanvasPreview
        sections={sections}
        navTitles={pages.filter((p) => p.inNav).map((p) => p.title)}
        label={`${page.title} page`}
      />
    </>
  );
}
