import { cn } from "@/lib/utils";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  touch?: boolean;
  size?: "desktop" | "touch";
};

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  touch = false,
  size,
}: ToggleProps) {
  const resolved = size ?? (touch ? "touch" : undefined);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        resolved === "touch" && "size-11",
        resolved === "desktop" && "h-5 w-8",
        !resolved && "size-11 sm:h-5 sm:w-8",
        disabled && "cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "relative h-5 w-8 rounded-full",
          disabled && checked && "bg-ink-4",
          disabled && !checked && "bg-surface-2",
          !disabled && checked && "bg-ink",
          !disabled && !checked && "bg-line",
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
