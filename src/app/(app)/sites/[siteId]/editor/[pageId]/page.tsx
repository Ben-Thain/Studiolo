import type { Metadata } from "next";
import { EditorDesktop } from "@/components/sites/editor-desktop";
import { RememberLastPage } from "@/components/sites/editor-href";
import { loadEditorDoc } from "@/lib/editor/load";
import { getSite, requireSitePage } from "@/lib/sites/data";

export const metadata: Metadata = { title: "Editor · Studiolo" };

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  const { siteId, pageId } = await params;
  const query = await searchParams;
  const site = await getSite(siteId);
  const page = await requireSitePage(siteId, pageId);
  const doc = await loadEditorDoc(siteId);
  return (
    <>
      <RememberLastPage siteId={siteId} pageId={page.id} />
      <h1 className="sr-only">
        {site.name}: {page.title}
      </h1>
      <EditorDesktop
        siteId={siteId}
        pageId={page.id}
        initialDoc={doc}
        initialLayout={query.layout === "mobile" ? "mobile" : "desktop"}
      />
    </>
  );
}
