import type { Metadata } from "next";
import { PageHead } from "@/components/ui/page-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AREA_COPY } from "@/lib/sites/copy";
import { getSitePages, pagePath } from "@/lib/sites/data";

export const metadata: Metadata = { title: "Pages · Studiolo" };

function HomeBadge() {
  return (
    <span className="ml-2 inline-flex h-5 items-center rounded-[4px] border border-line px-1.5 text-xs leading-4 text-ink-2">
      {AREA_COPY.home}
    </span>
  );
}

// Pages (prompt 07 builds reorder, rename, home and menu toggles). Read-only.
export default async function PagesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const pages = await getSitePages(siteId);
  return (
    <>
      <PageHead
        size="responsive"
        title={AREA_COPY.pagesTitle}
        lead={AREA_COPY.pagesLead}
      />
      <Table className="hidden max-w-[944px] table-fixed min-[900px]:table">
        <colgroup>
          <col className="w-[480px]" />
          <col />
          <col className="w-[160px]" />
        </colgroup>
        <TableHeader>
          <TableRow header>
            <TableHead>{AREA_COPY.page}</TableHead>
            <TableHead>{AREA_COPY.pageAddress}</TableHead>
            <TableHead>{AREA_COPY.inMenu}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((page) => (
            <TableRow key={page.id} className="h-12">
              <TableCell className="h-12 text-sm leading-5 font-medium text-ink">
                {page.title}
                {page.isHome ? <HomeBadge /> : null}
              </TableCell>
              <TableCell className="h-12 text-sm leading-5 text-ink-3">
                {pagePath(page)}
              </TableCell>
              <TableCell className="h-12 text-sm leading-5 text-ink-2">
                {page.inNav ? AREA_COPY.yes : AREA_COPY.no}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ul className="min-[900px]:hidden">
        {pages.map((page) => (
          <li
            key={page.id}
            className="flex min-h-16 flex-col justify-center border-b border-line py-2"
          >
            <span className="text-base leading-6 font-medium text-ink">
              {page.title}
              {page.isHome ? <HomeBadge /> : null}
            </span>
            <span className="text-[13px] leading-4 text-ink-3">
              {pagePath(page)} ·{" "}
              {page.inNav ? AREA_COPY.inMenu : AREA_COPY.notInMenu}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-4 text-ink-3">{AREA_COPY.pagesNote}</p>
    </>
  );
}
