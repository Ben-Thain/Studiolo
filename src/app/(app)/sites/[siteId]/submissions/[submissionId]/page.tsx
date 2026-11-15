import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalDate } from "@/components/home/local-date";
import { Icon } from "@/components/ui/icons";
import { AREA_COPY } from "@/lib/sites/copy";
import { getSite, isUuid } from "@/lib/sites/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Submission · Studiolo" };

// One submission (prompt 12). Unknown or another site's id → 404.
export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ siteId: string; submissionId: string }>;
}) {
  const { siteId, submissionId } = await params;
  await getSite(siteId);
  if (!isUuid(submissionId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("id, name, email, message, created_at")
    .eq("site_id", siteId)
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw new Error("Could not load this submission.");
  if (!data) notFound();
  return (
    <article className="max-w-[640px]">
      <Link
        href={`/sites/${siteId}/submissions`}
        className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-control px-1 text-sm leading-5 text-ink-2 min-[900px]:min-h-8"
      >
        <Icon name="chevron-left" size={16} />
        {AREA_COPY.backToSubmissions}
      </Link>
      <h1 className="mt-4 text-2xl leading-8 font-medium tracking-[-0.02em] text-ink">
        {data.name}
      </h1>
      <p className="mt-1 text-sm leading-5 text-ink-3">
        {data.email} · <LocalDate iso={data.created_at} format="day-month" />
      </p>
      <p className="mt-6 text-base leading-6 whitespace-pre-line text-ink">
        {data.message}
      </p>
    </article>
  );
}
