import { studioloAddress } from "@/lib/addresses";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SITES_COPY } from "@/lib/sites/copy";
import type { DeletedSiteItem } from "@/lib/home/data";
import { LocalDate } from "./local-date";
import { RestoreSiteButton } from "./restore-site-button";

export function DeletedSitesTable({ sites }: { sites: DeletedSiteItem[] }) {
  return (
  <>
      <Table className="hidden max-w-[944px] table-fixed min-[900px]:table">
        <colgroup>
          <col />
          <col className="w-[120px]" />
          <col className="w-[120px]" />
          <col className="w-[120px]" />
        </colgroup>
        <TableHeader>
          <TableRow header>
            <TableHead>Site</TableHead>
            <TableHead className="text-center">
              {SITES_COPY.deletedColumns.deleted}
            </TableHead>
            <TableHead className="text-center">
              {SITES_COPY.deletedColumns.deletesOn}
            </TableHead>
            <TableHead>
              <span className="sr-only">{SITES_COPY.restore}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sites.map((site) => (
            <TableRow key={site.id} className="h-16">
              <TableCell>
                <div className="truncate text-sm leading-5 font-medium text-ink">
                  {site.name}
                </div>
                <div className="mt-0.5 truncate text-xs leading-4 text-ink-3">
                  {site.address}
                </div>
              </TableCell>
              <TableCell className="text-center text-sm leading-5 text-ink-2">
                <LocalDate iso={site.deletedAt} format="day-month" />
              </TableCell>
              <TableCell className="text-center text-sm leading-5 text-ink-2">
                <LocalDate iso={site.purgeAfter} format="day-month" />
              </TableCell>
              <TableCell className="text-right">
                <RestoreSiteButton siteId={site.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul className="min-[900px]:hidden">
        {sites.map((site) => (
          <li key={site.id} className="border-b border-line py-4">
            <div className="text-base leading-6 font-medium text-ink">
              {site.name}
            </div>
            <div className="mt-0.5 text-sm leading-5 text-ink-3">
              {studioloAddress(site.slug)}
            </div>
            <div className="mt-2 flex gap-4 text-sm leading-5 text-ink-2">
              <span>
                {SITES_COPY.deletedColumns.deleted}{" "}
                <LocalDate iso={site.deletedAt} format="day-month" />
              </span>
              <span>
                {SITES_COPY.deletedColumns.deletesOn}{" "}
                <LocalDate iso={site.purgeAfter} format="day-month" />
              </span>
            </div>
            <div className="mt-3">
              <RestoreSiteButton siteId={site.id} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}