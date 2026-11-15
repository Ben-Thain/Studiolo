import { notFound, redirect } from "next/navigation";
import { getSitePages, homePageOf } from "@/lib/sites/data";

// /sites/[siteId] opens the editor on the home page.
export default async function SitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const home = homePageOf(await getSitePages(siteId));
  if (!home) notFound();
  redirect(`/sites/${siteId}/editor/${home.id}`);
}
