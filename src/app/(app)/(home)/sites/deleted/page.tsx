import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DeletedSitesTable } from "@/components/home/deleted-sites-table";
import { PageHead } from "@/components/ui/page-head";
import { SidebarBack } from "@/components/ui/sidebar";
import { listRestorableSites } from "@/lib/home/data";
import { SITES_COPY } from "@/lib/sites/copy";

export const metadata: Metadata = {
  title: "Recently deleted · Studiolo",
};

export default async function RecentlyDeletedPage() {
  const sites = await listRestorableSites();
  if (sites.length === 0) redirect("/sites");

  return (
    <>
      <SidebarBack
        as={Link}
        href="/sites"
        className="mb-0 block max-w-[944px] h-7 min-h-11 min-[900px]:!-mt-1.5 min-[900px]:h-7 min-[900px]:min-h-0"
      >
        {SITES_COPY.back}
      </SidebarBack>
      <PageHead
        size="desktop"
        title={SITES_COPY.recentlyDeletedTitle}
        lead={SITES_COPY.recentlyDeletedLead}
        className="!mt-2 !mb-6"
      />
      <DeletedSitesTable sites={sites} />
      <p className="mt-6 max-w-[560px] text-xs leading-4 text-ink-3">
        {SITES_COPY.recentlyDeletedFootnote}
      </p>
    </>
  );
}
