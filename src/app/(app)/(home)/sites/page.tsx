import type { Metadata } from "next";
import { SitesList } from "@/components/home/sites-list";
import { FirstSite } from "@/components/sites/first-site";
import { NewSiteButton } from "@/components/sites/new-site-dialog";
import { PageHead } from "@/components/ui/page-head";
import { studioloAddressParts } from "@/lib/addresses";
import { HOME_COPY } from "@/lib/home/copy";
import { RecentlyDeletedLink } from "@/components/home/recently-deleted-link";
import { countRestorableSites, listSites } from "@/lib/home/data";

export const metadata: Metadata = { title: "Sites · Studiolo" };

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; highlight?: string }>;
}) {
  const [sites, restorableCount, params] = await Promise.all([
    listSites(),
    countRestorableSites(),
    searchParams,
  ]);
  const parts = studioloAddressParts();
  if (sites.length === 0) {
    return <FirstSite parts={parts} restorableCount={restorableCount} />;
  }
  return (
    <>
      <PageHead
        size="responsive"
        title={HOME_COPY.sitesTitle}
        lead={HOME_COPY.sitesLead}
        action={<NewSiteButton parts={parts} requested={params.new === "1"} />}
      />
      <SitesList sites={sites} highlightId={params.highlight} />
      <RecentlyDeletedLink count={restorableCount} className="max-w-[944px]" />
    </>
  );
}
