import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "destructive";

export type ButtonSize = "sm" | "lg" | "touch";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-bg",
  secondary: "border border-line bg-bg text-ink hover:bg-fill-hover",
  ghost: "bg-transparent text-ink hover:bg-fill-hover",
  danger: "bg-transparent text-error hover:bg-fill-hover",
  destructive: "bg-error text-bg",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-2 px-3 text-sm",
  lg: "h-10 gap-2 px-4 text-sm",
  touch: "h-12 gap-2 px-4 text-base",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  chevron?: boolean;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "sm",
  icon,
  chevron = false,
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-control font-medium whitespace-nowrap",
        "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-ink-disabled",
        variants[variant],
        sizes[size],
        variant === "primary" && !isDisabled && "hover:opacity-90",
        variant === "destructive" && !isDisabled && "hover:opacity-90",
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {chevron ? <Icon name="chevron-down" size={14} /> : null}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="motion-safe-spin animate-spin"
    >
      <circle
        cx="8"
        cy="8"
        r="5.25"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <path
        d="M13.25 8a5.25 5.25 0 0 0-5.25-5.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
