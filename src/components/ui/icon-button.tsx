import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ForceState } from "./button";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: "md" | "touch" | "desktop";
  forceState?: ForceState;
  children: ReactNode;
};

const sizes = {
  md: "size-10",
  desktop: "size-10",
  touch: "size-11",
};

export function IconButton({
  label,
  size,
  forceState,
  className,
  children,
  type = "button",
  disabled,
  ...props
}: IconButtonProps) {
  const isDisabled = disabled || forceState === "disabled";
  return (
    <button
      type={type}
      aria-label={label}
      data-force-state={forceState}
      data-variant="icon"
      disabled={isDisabled}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-control text-ink-2",
        "enabled:hover:bg-fill-hover enabled:active:bg-fill-selected",
        "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ink-4",
        size ? sizes[size] : "size-11 sm:size-10",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
