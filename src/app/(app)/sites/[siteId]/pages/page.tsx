import type { Metadata } from "next";
import { PagesBoard } from "@/components/sites/pages-board";
import { loadEditorDoc } from "@/lib/editor/load";
import { getSite } from "@/lib/sites/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pages · Studiolo" };

export default async function PagesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await getSite(siteId);
  const doc = await loadEditorDoc(siteId);
  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("first_published_at")
    .eq("id", siteId)
    .maybeSingle();
  return (
    <PagesBoard
      initialDoc={doc}
      published={Boolean(site?.first_published_at)}
    />
  );
}
