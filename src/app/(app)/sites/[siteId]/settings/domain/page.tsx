import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { AREA_COPY } from "@/lib/sites/copy";
import { getSite } from "@/lib/sites/data";

export const metadata: Metadata = { title: "Custom domain · Studiolo" };

// Custom domain (prompt 11 builds connect, DNS and status). Read-only.
export default async function DomainPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  return (
    <div className="max-w-[640px]">
      <Link
        href={`/sites/${siteId}/settings`}
        className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-control px-1 text-sm leading-5 text-ink-2 min-[900px]:min-h-8"
      >
        <Icon name="chevron-left" size={16} />
        {AREA_COPY.backToSettings}
      </Link>
      <h1 className="mt-4 text-2xl leading-8 font-medium tracking-[-0.02em] text-ink">
        {AREA_COPY.domainTitle}
      </h1>
      <p className="mt-1 text-sm leading-5 text-ink-3">
        {AREA_COPY.domainLead}
      </p>
      <p className="mt-6 text-sm leading-5 text-ink">
        {site.domain
          ? `${site.domain.hostname} · ${
              AREA_COPY.status[
                site.domain.status as keyof typeof AREA_COPY.status
              ] ?? site.domain.status
            }`
          : AREA_COPY.domainNone}
      </p>
      <p className="mt-4 text-xs leading-4 text-ink-3">
        {AREA_COPY.domainNote}
      </p>
    </div>
  );
}
