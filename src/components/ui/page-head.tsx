import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHead({
  title,
  lead,
  action,
  size = "desktop",
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
  size?: "desktop" | "mobile";
}) {
  return (
    <div className="mb-8 flex max-w-[944px] items-start justify-between gap-4">
      <div className="min-w-0">
        <h1
          className={cn(
            "font-medium tracking-[-0.02em] text-ink",
            size === "mobile" ? "text-[32px] leading-10" : "text-2xl leading-8",
          )}
        >
          {title}
        </h1>
        {lead ? (
          <p className="mt-1 text-sm leading-5 text-ink-3">{lead}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
