"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { MobileListRow } from "@/components/ui/mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowLink,
} from "@/components/ui/table";
import { StatusDot } from "@/components/ui/top-bar";
import { HOME_COPY } from "@/lib/home/copy";
import { cn } from "@/lib/utils";
import type { SiteListItem } from "@/lib/home/data";
import { LocalDate } from "./local-date";
import { SiteRowMenu } from "./site-row-menu";

function StatusText({ site }: { site: SiteListItem }) {
  return (
    <>
      {site.status === "live" ? HOME_COPY.live : HOME_COPY.draft}
      {site.passwordOn ? (
        <span className="inline-flex text-ink-3">
          <Icon name="lock" size={12} />
          <span className="sr-only">{HOME_COPY.passwordOn}</span>
        </span>
      ) : null}
    </>
  );
}

/** Column widths and the 40px header row, shared with the loading state. */
export function SitesTableHead() {
  return (
    <>
      <colgroup>
        <col className="w-[312px]" />
        <col className="w-[185px]" />
        <col className="w-[263px]" />
        <col />
        <col className="w-10" />
      </colgroup>
      <TableHeader>
        <TableRow header>
          <TableHead>{HOME_COPY.columns.site}</TableHead>
          <TableHead>{HOME_COPY.columns.status}</TableHead>
          <TableHead>{HOME_COPY.columns.domain}</TableHead>
          <TableHead>{HOME_COPY.columns.lastEdited}</TableHead>
          <TableHead>
            <span className="sr-only">{HOME_COPY.columns.actions}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
    </>
  );
}

/** How long a new or restored row keeps its highlight. */
const HIGHLIGHT_MS = 4000;

/**
 * Sites list: a table from 900px (d-sites.png), rows below (m-sites.png).
 * `highlightId` (from /sites?highlight=…, after Duplicate) gives that row the
 * #FAFAFA highlight for ~4s, then it fades, and moves focus to its link.
 */
export function SitesList({
  sites,
  highlightId,
}: {
  sites: SiteListItem[];
  highlightId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [faded, setFaded] = useState<string | null>(null);
  const highlighted =
    highlightId &&
    highlightId !== faded &&
    sites.some((site) => site.id === highlightId)
      ? highlightId
      : null;

  useEffect(() => {
    if (!highlighted) return;
    const wide = window.matchMedia("(min-width: 900px)").matches;
    document
      .getElementById(`${wide ? "site-link" : "site-row"}-${highlighted}`)
      ?.focus();
    const timer = window.setTimeout(() => {
      setFaded(highlighted);
      router.replace(pathname, { scroll: false });
    }, HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlighted, router, pathname]);

  return (
    <>
      <Table className="hidden max-w-[944px] table-fixed min-[900px]:table">
        <SitesTableHead />
        <TableBody>
          {sites.map((site) => (
            <TableRow
              key={site.id}
              interactive
              highlight={site.id === highlighted}
              data-highlighted={site.id === highlighted ? "" : undefined}
            >
              <TableCell>
                <TableRowLink
                  id={`site-link-${site.id}`}
                  href={`/sites/${site.id}`}
                  className="block truncate text-sm leading-5 font-medium text-ink"
                >
                  {site.name}
                </TableRowLink>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2 text-sm leading-5 text-ink-2">
                  <StatusDot status={site.status} />
                  <StatusText site={site} />
                </span>
              </TableCell>
              <TableCell>
                <span className="block truncate text-sm leading-5 text-ink-2">
                  {site.address}
                </span>
              </TableCell>
              <TableCell className="text-sm leading-5 whitespace-nowrap text-ink-3">
                <LocalDate iso={site.lastEditedAt} format="last-edited" />
              </TableCell>
              <TableCell className="relative z-10 text-center">
                <SiteRowMenu
                  siteId={site.id}
                  name={site.name}
                  live={site.status === "live"}
                  url={site.url}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul className="min-[900px]:hidden">
        {sites.map((site) => (
          <li
            key={site.id}
            className={cn(
              "transition-colors duration-700 motion-reduce:transition-none",
              site.id === highlighted && "bg-fill-hover",
            )}
          >
            <MobileListRow
              id={`site-row-${site.id}`}
              href={`/sites/${site.id}`}
              name={site.name}
              meta={site.address}
              leading={<StatusDot status={site.status} />}
              trailing={
                <span className="flex shrink-0 items-center gap-2 text-sm leading-5 text-ink-2">
                  <StatusText site={site} />
                </span>
              }
            />
          </li>
        ))}
      </ul>
    </>
  );
}
