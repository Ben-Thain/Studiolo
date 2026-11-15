import type { Metadata } from "next";
import Link from "next/link";
import { LocalDate } from "@/components/home/local-date";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { PageHead } from "@/components/ui/page-head";
import { AREA_COPY } from "@/lib/sites/copy";
import { getSite } from "@/lib/sites/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Submissions · Studiolo" };

// Submissions (prompt 12 builds read state, delete and export). Read-only.
export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await getSite(siteId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("id, name, email, created_at, read_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Could not load submissions.");
  return (
    <>
      <PageHead
        size="responsive"
        title={AREA_COPY.submissionsTitle}
        lead={AREA_COPY.submissionsLead}
      />
      {data.length === 0 ? (
        <EmptyState
          title={AREA_COPY.noSubmissions}
          lead={AREA_COPY.noSubmissionsLead}
        />
      ) : (
        <ul className="max-w-[944px] border-t border-line">
          {data.map((row) => (
            <li key={row.id}>
              <Link
                href={`/sites/${siteId}/submissions/${row.id}`}
                className="flex min-h-14 items-center gap-4 border-b border-line py-2 hover:bg-fill-hover max-[899px]:min-h-16"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-medium text-ink max-[899px]:text-base max-[899px]:leading-6">
                    {row.name}
                  </span>
                  <span className="block truncate text-xs leading-4 text-ink-3 max-[899px]:text-[13px]">
                    {row.email}
                  </span>
                </span>
                <span className="shrink-0 text-sm leading-5 text-ink-3">
                  <LocalDate iso={row.created_at} format="day-month" />
                </span>
                <Icon
                  name="chevron-right"
                  size={16}
                  className="shrink-0 text-ink-3"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
