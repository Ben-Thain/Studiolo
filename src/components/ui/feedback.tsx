import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function EmptyState({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 py-8">
      <h2 className="text-sm leading-5 font-medium text-ink">{title}</h2>
      {lead ? <p className="text-sm leading-5 text-ink-3">{lead}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex h-14 items-center border-b border-line"
        >
          <div className="h-4 w-40 animate-pulse rounded-control bg-fill-selected motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

export function InlineError({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <p className="flex items-center gap-2 text-xs leading-4 text-error">
      <span>{children}</span>
      {onRetry ? (
        <Button variant="ghost" onClick={onRetry} className="h-8 text-error">
          Retry
        </Button>
      ) : null}
    </p>
  );
}

export function SelectionFrame({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative border border-ink", className)}>
      {children}
      {[
        "left-[-4px] top-[-4px]",
        "right-[-4px] top-[-4px]",
        "bottom-[-4px] left-[-4px]",
        "right-[-4px] bottom-[-4px]",
      ].map((position) => (
        <span
          key={position}
          className={cn("absolute size-2 border border-ink bg-bg", position)}
        />
      ))}
    </div>
  );
}

export function ReadoutChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-control bg-ink px-2 text-xs leading-4 text-bg shadow-pop">
      {children}
    </span>
  );
}

export function UndoChip({
  children,
  action,
}: {
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-control bg-ink px-3 text-[13px] text-bg shadow-float">
      {children}
      {action}
    </span>
  );
}

export function GuideLine() {
  return <div className="h-px w-full bg-ink" />;
}
