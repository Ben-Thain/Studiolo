import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/feedback";
import { PageHead } from "@/components/ui/page-head";
import { AREA_COPY } from "@/lib/sites/copy";
import { getSite } from "@/lib/sites/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Stats · Studiolo" };

/** The first day of the last 7 (UTC), as YYYY-MM-DD. */
function firstOfLastSevenDays(): string {
  return new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
}

// Stats (prompt 13 builds the chart and ranges). Last 7 days, read-only.
export default async function StatsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await getSite(siteId);
  const supabase = await createClient();
  const since = firstOfLastSevenDays();
  const { data, error } = await supabase
    .from("page_views_daily")
    .select("day, views")
    .eq("site_id", siteId)
    .gte("day", since);
  if (error) throw new Error("Could not load stats.");
  const total = data.reduce((sum, row) => sum + row.views, 0);
  return (
    <>
      <PageHead
        size="responsive"
        title={AREA_COPY.statsTitle}
        lead={AREA_COPY.statsLead}
      />
      {total === 0 ? (
        <EmptyState title={AREA_COPY.noViews} lead={AREA_COPY.noViewsLead} />
      ) : (
        <div>
          <p className="text-xs leading-4 text-ink-3">{AREA_COPY.views}</p>
          <p className="mt-1 text-[32px] leading-10 font-medium tracking-[-0.02em] text-ink">
            {total.toLocaleString("en-GB")}
          </p>
        </div>
      )}
    </>
  );
}
