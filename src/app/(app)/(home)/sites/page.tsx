import type { Metadata } from "next";
import { SitesList } from "@/components/home/sites-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { PageHead } from "@/components/ui/page-head";
import { HOME_COPY } from "@/lib/home/copy";
import { listSites } from "@/lib/home/data";

export const metadata: Metadata = { title: "Sites · Studiolo" };

export default async function SitesPage() {
  const sites = await listSites();
  return (
    <>
      <PageHead
        size="responsive"
        title={HOME_COPY.sitesTitle}
        lead={HOME_COPY.sitesLead}
        action={
          // Prompt 04 wires New site.
          <Button
            size="desktop"
            icon={<Icon name="plus" size={16} />}
            aria-disabled="true"
            title={HOME_COPY.availableSoon}
          >
            {HOME_COPY.newSite}
          </Button>
        }
      />
      {sites.length === 0 ? (
        <EmptyState title={HOME_COPY.noSites} />
      ) : (
        <SitesList sites={sites} />
      )}
    </>
  );
}
