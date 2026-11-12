import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "destructive";

export type ButtonSize = "sm" | "lg" | "touch" | "nav" | "desktop";

export type ForceState = "hover" | "active" | "focus" | "disabled" | "loading";

const focusForce =
  "outline outline-2 outline-offset-2 outline-[rgba(10,10,10,0.4)]";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-bg enabled:hover:bg-ink-hover enabled:active:bg-ink-hover",
  secondary:
    "border border-line bg-bg text-ink enabled:hover:bg-fill-hover enabled:active:bg-fill-selected",
  ghost:
    "bg-transparent text-ink enabled:hover:bg-fill-hover enabled:active:bg-fill-selected",
  danger:
    "bg-transparent text-error enabled:hover:bg-fill-hover enabled:active:bg-fill-selected",
  destructive:
    "bg-error text-bg enabled:hover:bg-error-hover enabled:active:bg-error-hover",
};

const disabledVariants: Record<ButtonVariant, string> = {
  primary: "bg-surface-2 text-ink-4",
  secondary: "border border-line bg-bg text-ink-4",
  ghost: "bg-transparent text-ink-4",
  danger: "bg-transparent text-ink-4",
  destructive: "bg-surface-2 text-ink-4",
};

const forced: Record<ButtonVariant, Record<"hover" | "active", string>> = {
  primary: { hover: "bg-ink-hover", active: "bg-ink-hover" },
  secondary: { hover: "bg-fill-hover", active: "bg-fill-selected" },
  ghost: { hover: "bg-fill-hover", active: "bg-fill-selected" },
  danger: { hover: "bg-fill-hover", active: "bg-fill-selected" },
  destructive: { hover: "bg-error-hover", active: "bg-error-hover" },
};

const sizes: Record<Exclude<ButtonSize, "nav">, string> = {
  sm: "h-8 gap-2 px-3 text-sm",
  desktop: "h-8 gap-2 px-3 text-sm",
  lg: "h-10 gap-2 px-4 text-sm",
  touch: "h-12 gap-2 px-4 text-base",
};

const responsiveSize = "h-12 gap-2 px-4 text-base sm:h-8 sm:gap-2 sm:px-3 sm:text-sm";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  chevron?: boolean;
  loading?: boolean;
  forceState?: ForceState;
};

export function Button({
  variant = "primary",
  size,
  icon,
  chevron = false,
  loading = false,
  forceState,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading || forceState === "disabled";
  const isLoading = loading || forceState === "loading";
  const visual = cn(
    variants[variant],
    isDisabled && disabledVariants[variant],
    !isDisabled && forceState === "hover" && forced[variant].hover,
    !isDisabled && forceState === "active" && forced[variant].active,
  );
  const content = (
    <>
      {isLoading ? <Spinner /> : icon}
      {children}
      {chevron ? <Icon name="chevron-down" size={14} /> : null}
    </>
  );

  if (size === "nav") {
    return (
      <button
        type={type}
        data-force-state={forceState}
        className={cn(
          "inline-flex h-11 items-center justify-center bg-transparent",
          forceState === "focus" && focusForce,
          className,
        )}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        {...props}
      >
        <span
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 rounded-control px-3 text-sm font-medium whitespace-nowrap",
            visual,
          )}
        >
          {content}
        </span>
      </button>
    );
  }

  return (
    <button
      type={type}
      data-force-state={forceState}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-control font-medium whitespace-nowrap",
        "disabled:cursor-not-allowed",
        visual,
        size ? sizes[size] : responsiveSize,
        forceState === "focus" && focusForce,
        className,
      )}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {content}
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
