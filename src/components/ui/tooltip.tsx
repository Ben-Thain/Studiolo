"use client";

import {
  cloneElement,
  useId,
  useState,
  type ReactElement,
  type HTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

type TriggerProps = HTMLAttributes<HTMLElement> & {
  "aria-describedby"?: string;
};

/**
 * A short label shown under its trigger on hover and keyboard focus, and
 * linked with aria-describedby (e.g. "Publishing comes next" on an
 * aria-disabled Publish button). Ink chip, white 12px text, 6px radius.
 * Escape hides it.
 */
export function Tooltip({
  label,
  children,
  align = "end",
}: {
  label: string;
  children: ReactElement<TriggerProps>;
  align?: "start" | "center" | "end";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = cloneElement(children, {
    "aria-describedby": id,
    onMouseEnter: (event) => {
      children.props.onMouseEnter?.(event);
      setOpen(true);
    },
    onMouseLeave: (event) => {
      children.props.onMouseLeave?.(event);
      setOpen(false);
    },
    onFocus: (event) => {
      children.props.onFocus?.(event);
      setOpen(true);
    },
    onBlur: (event) => {
      children.props.onBlur?.(event);
      setOpen(false);
    },
    onKeyDown: (event) => {
      children.props.onKeyDown?.(event);
      if (event.key === "Escape") setOpen(false);
    },
  });
  return (
    <span className="relative inline-flex">
      {trigger}
      <span
        id={id}
        role="tooltip"
        data-open={open ? "" : undefined}
        className={cn(
          "pointer-events-none absolute top-[calc(100%+6px)] z-50 rounded-control bg-ink px-2 py-1 text-xs leading-4 whitespace-nowrap text-bg shadow-float",
          align === "end" && "right-0",
          align === "start" && "left-0",
          align === "center" && "left-1/2 -translate-x-1/2",
          open ? "visible" : "invisible",
        )}
      >
        {label}
      </span>
    </span>
  );
}
