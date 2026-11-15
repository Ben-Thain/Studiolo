import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/sites/site-shell";
import { getAccountLine } from "@/lib/home/data";
import { getSite, getSitePages, homePageOf } from "@/lib/sites/data";

// The site shell for every site area (prompt 04a). getSite 404s for a site
// that doesn't exist, is soft-deleted or belongs to someone else.
export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  const [pages, account] = await Promise.all([
    getSitePages(siteId),
    getAccountLine(),
  ]);
  const home = homePageOf(pages);
  if (!home) notFound();
  return (
    <SiteShell
      site={{
        id: site.id,
        name: site.name,
        status: site.status,
        passwordOn: site.passwordOn,
        address: site.address,
        url: site.url,
      }}
      pages={pages.map(({ id, title }) => ({ id, title }))}
      homePageId={home.id}
      trialText={account.trialText}
      initials={account.initials}
      accountName={account.name}
    >
      {children}
    </SiteShell>
  );
}
