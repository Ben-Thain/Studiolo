import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";

export function TopBar({
  left,
  right,
}: {
  left: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="relative z-20 flex h-14 items-center gap-2 border-b border-line bg-bg px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </header>
  );
}

export function StatusDot({ status }: { status: "live" | "draft" }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        status === "live" ? "bg-ink" : "border-[1.5px] border-ink-3",
      )}
      aria-hidden="true"
    />
  );
}

export function SiteStatus({
  name,
  status,
  locked = false,
}: {
  name: string;
  status: "live" | "draft";
  locked?: boolean;
}) {
  const label = status === "live" ? "Live" : "Draft";
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <span className="truncate font-medium text-ink">{name}</span>
      <StatusDot status={status} />
      <span className="text-ink">{label}</span>
      {locked ? (
        <span className="inline-flex text-ink-2">
          <Icon name="lock" size={12} />
          <span className="sr-only">Password on</span>
        </span>
      ) : null}
    </span>
  );
}
