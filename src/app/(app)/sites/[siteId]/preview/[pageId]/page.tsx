import Link from "next/link";

/** Stub until prompt 09 builds the real preview. */
export default async function PreviewStubPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  const { siteId, pageId } = await params;
  const query = await searchParams;
  const layout = query.layout === "mobile" ? "mobile" : "desktop";
  return (
    <div className="px-8 py-10">
      <p className="text-sm text-ink-2">Preview</p>
      <Link
        href={`/sites/${siteId}/editor/${pageId}?layout=${layout}`}
        className="mt-4 inline-flex text-sm text-ink underline"
      >
        Back to editor
      </Link>
    </div>
  );
}
