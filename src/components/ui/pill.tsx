import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-control border border-line px-2 text-xs leading-4 font-medium text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}
