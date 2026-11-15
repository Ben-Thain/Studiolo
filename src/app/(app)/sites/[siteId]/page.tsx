import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { requireOwnSite } from "@/lib/home/data";

export const metadata: Metadata = { title: "Site · Studiolo" };

// Prompt 04 builds the site area here. For now this route only proves the
// row links and ownership: another user's, a deleted or an unknown site id
// renders the app 404.
export default async function SitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await requireOwnSite(siteId);
  return (
    <main className="px-6 pt-4 min-[900px]:px-12">
      <Link
        href="/sites"
        className="inline-flex min-h-11 items-center gap-2 text-sm leading-5 text-ink-2"
      >
        <Icon name="chevron-left" size={16} />
        Sites
      </Link>
      <h1 className="mt-6 text-2xl leading-8 font-medium tracking-[-0.02em] text-ink">
        {site.name}
      </h1>
    </main>
  );
}
