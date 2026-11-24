import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { SITES_COPY } from "@/lib/sites/copy";
import { cn } from "@/lib/utils";

/** Quiet link under the Sites table or the empty state (d-sites-deleted-toast). */
export function RecentlyDeletedLink({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count < 1) return null;
  return (
    <Link
      href="/sites/deleted"
      className={cn(
        "inline-flex h-10 items-center gap-2 text-[13px] leading-5 text-ink-2",
        className,
      )}
    >
      <Icon name="trash" size={14} className="shrink-0 text-ink-4" />
      <span>{SITES_COPY.recentlyDeleted}</span>
      <span className="tabular text-ink-3">({count})</span>
      <Icon name="chevron-right" size={14} className="shrink-0 text-ink-3" />
    </Link>
  );
}