import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TemplatePreview } from "@/components/sites/template-preview";
import { isTemplateId, loadTemplate } from "@/templates/index";

export const metadata: Metadata = {
  title: "Template preview · Studiolo",
  robots: { index: false, follow: false },
};

export default async function TemplatePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{
    page?: string;
    layout?: string;
    back?: string;
    name?: string;
  }>;
}) {
  const { templateId } = await params;
  if (!isTemplateId(templateId)) notFound();
  const query = await searchParams;
  const template = loadTemplate(templateId);
  const back = query.back?.startsWith("/sites") ? query.back : "/sites";
  return (
    <TemplatePreview
      template={template}
      initialPage={query.page}
      initialLayout={query.layout}
      back={back}
      name={query.name}
    />
  );
}
