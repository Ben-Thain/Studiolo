import { cn } from "@/lib/utils";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  touch?: boolean;
  size?: "desktop" | "touch";
  forceState?: "hover" | "focus" | "active" | "disabled";
};

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  touch = false,
  size,
  forceState,
}: ToggleProps) {
  const resolved = size ?? (touch ? "touch" : undefined);
  const isDisabled = disabled || forceState === "disabled";
  const forced = forceState === "hover" || forceState === "active";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={isDisabled}
      data-force-state={forceState}
      onClick={() => onChange(!checked)}
      className={cn(
        "group inline-flex shrink-0 items-center justify-center rounded-full",
        resolved === "touch" && "size-11",
        resolved === "desktop" && "h-5 w-8",
        !resolved && "size-11 sm:h-5 sm:w-8",
        isDisabled && "cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "relative h-5 w-8 rounded-full",
          isDisabled && checked && "bg-ink-4",
          isDisabled && !checked && "bg-surface-2",
          !isDisabled && checked && "bg-ink group-hover:bg-ink-hover group-active:bg-ink-hover",
          !isDisabled && !checked && "bg-line group-hover:bg-ink-4 group-active:bg-ink-4",
          !isDisabled && forced && checked && "bg-ink-hover",
          !isDisabled && forced && !checked && "bg-ink-4",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-bg",
            checked ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
