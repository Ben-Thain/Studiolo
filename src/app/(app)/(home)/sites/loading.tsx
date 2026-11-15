import { Skeleton } from "@/components/ui/feedback";
import { PageHead } from "@/components/ui/page-head";
import { HOME_COPY } from "@/lib/home/copy";

export default function SitesLoading() {
  return (
    <>
      <PageHead
        size="responsive"
        title={HOME_COPY.sitesTitle}
        lead={HOME_COPY.sitesLead}
      />
      <div role="status" className="max-w-[944px]">
        <span className="sr-only">Loading sites</span>
        <Skeleton rows={3} />
      </div>
    </>
  );
}
