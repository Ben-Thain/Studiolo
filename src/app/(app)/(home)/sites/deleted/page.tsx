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
      <div className="mb-6 max-w-[944px]">
        <SidebarBack as={Link} href="/sites">
          {SITES_COPY.back}
        </SidebarBack>
      </div>
      <PageHead
        title={SITES_COPY.recentlyDeletedTitle}
        lead={SITES_COPY.recentlyDeletedLead}
      />
      <DeletedSitesTable sites={sites} />
      <p className="mt-6 max-w-[560px] text-xs leading-4 text-ink-3">
        {SITES_COPY.recentlyDeletedFootnote}
      </p>
    </>
  );
}