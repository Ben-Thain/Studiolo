import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: "md" | "touch";
  children: ReactNode;
};

const sizes = {
  md: "size-10",
  touch: "size-11",
};

export function IconButton({
  label,
  size = "md",
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-fill-hover disabled:cursor-not-allowed disabled:text-ink-disabled",
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
