import type { AddressParts } from "@/lib/addresses";
import { RecentlyDeletedLink } from "@/components/home/recently-deleted-link";
import { SITES_COPY } from "@/lib/sites/copy";
import { NewSiteForm } from "./new-site-form";

/**
 * Zero sites (d-empty.png): no page head, a centred 480px column that leads
 * with creating. Desktop: the column's top sits 200px from the top.
 */
export function FirstSite({
  parts,
  restorableCount = 0,
}: {
  parts: AddressParts;
  restorableCount?: number;
}) {
  return (
    <section
      aria-labelledby="first-site-title"
      className="mx-auto w-full max-w-[480px] pt-4 min-[900px]:pt-40"
    >
      <h1
        id="first-site-title"
        className="text-xl leading-7 font-medium tracking-[-0.01em] text-ink"
      >
        {SITES_COPY.firstTitle}
      </h1>
      <p className="mt-3 text-sm leading-5 text-ink-3">
        {SITES_COPY.firstLead}
      </p>
      <NewSiteForm variant="first" parts={parts} />
      <div className="mt-6 flex justify-center">
        <RecentlyDeletedLink count={restorableCount} />
      </div>
    </section>
  );
}
