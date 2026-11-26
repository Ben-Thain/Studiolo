import type { Metadata } from "next";
import { SitesList } from "@/components/home/sites-list";
import { FirstSite } from "@/components/sites/first-site";
import { MobileNewSite } from "@/components/sites/mobile-new-site";
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
  searchParams: Promise<{
    new?: string;
    highlight?: string;
    template?: string;
    name?: string;
    step?: string;
    focus?: string;
  }>;
}) {
  const [sites, restorableCount, params] = await Promise.all([
    listSites(),
    countRestorableSites(),
    searchParams,
  ]);
  const parts = studioloAddressParts();
  if (sites.length === 0) {
    return (
      <>
        <FirstSite
          key={`${params.template ?? "blank"}:${params.name ?? ""}`}
          parts={parts}
          restorableCount={restorableCount}
          initialTemplate={params.template}
          initialName={params.name}
          focusName={params.focus === "name"}
        />
        {params.new === "1" ? (
          <MobileNewSite
            parts={parts}
            initialTemplate={params.template}
            initialName={params.name}
            initialStep={params.step}
          />
        ) : null}
      </>
    );
  }
  return (
    <>
      <PageHead
        size="responsive"
        title={HOME_COPY.sitesTitle}
        lead={HOME_COPY.sitesLead}
        action={
          <NewSiteButton
            key={`${params.template ?? "blank"}:${params.name ?? ""}`}
            parts={parts}
            requested={params.new === "1"}
            initialTemplate={params.template}
            initialName={params.name}
            focusName={params.focus === "name"}
            initialStep={params.step}
          />
        }
      />
      <SitesList sites={sites} highlightId={params.highlight} />
      <RecentlyDeletedLink
        count={restorableCount}
        className="mt-2 max-w-[944px]"
      />
    </>
  );
}
