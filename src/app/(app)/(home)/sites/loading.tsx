import { SitesTableHead } from "@/components/home/sites-list";
import { Skeleton } from "@/components/ui/feedback";
import { PageHead } from "@/components/ui/page-head";
import { Table } from "@/components/ui/table";
import { HOME_COPY } from "@/lib/home/copy";

// Same geometry as the loaded page (header row, 56px desktop / 64px mobile
// rows), so nothing shifts when the sites arrive.
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
        <Table className="hidden max-w-[944px] table-fixed min-[900px]:table">
          <SitesTableHead />
        </Table>
        <Skeleton rows={3} size="responsive" />
      </div>
    </>
  );
}
