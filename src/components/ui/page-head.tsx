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
  /**
   * "responsive": the home screens. Below 900px a 32/40 title only (the
   * mobile nav bar carries the action); from 900px the desktop head.
   */
  size?: "desktop" | "mobile" | "responsive";
}) {
  const responsive = size === "responsive";
  return (
    <div
      className={cn(
        "flex max-w-[944px] items-start justify-between gap-4",
        responsive ? "mb-4 min-[900px]:mb-8" : "mb-8",
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            "font-medium tracking-[-0.02em] text-ink",
            size === "mobile" && "text-[32px] leading-10",
            size === "desktop" && "text-2xl leading-8",
            responsive &&
              "text-[32px] leading-10 min-[900px]:text-2xl min-[900px]:leading-8",
          )}
        >
          {title}
        </h1>
        {lead ? (
          <p
            className={cn(
              "mt-1 text-sm leading-5 text-ink-3",
              responsive && "hidden min-[900px]:block",
            )}
          >
            {lead}
          </p>
        ) : null}
      </div>
      {action ? (
        <div
          className={cn("shrink-0", responsive && "hidden min-[900px]:block")}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}
