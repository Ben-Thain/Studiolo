import { PageHead } from "@/components/ui/page-head";
import { AREA_COPY } from "@/lib/sites/copy";

export default function PagesLoading() {
  return (
    <>
      <PageHead
        size="responsive"
        title={AREA_COPY.pagesTitle}
        lead={AREA_COPY.pagesLead}
      />
      <div role="status" className="max-w-[944px]">
        <span className="sr-only">Loading pages</span>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-12 border-b border-line" />
        ))}
      </div>
    </>
  );
}
