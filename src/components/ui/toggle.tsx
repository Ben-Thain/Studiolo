import { cn } from "@/lib/utils";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  touch?: boolean;
};

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  touch = false,
}: ToggleProps) {
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
        touch ? "size-11" : "h-5 w-8",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "relative h-5 w-8 rounded-full transition-colors",
          checked ? "bg-ink" : "bg-line",
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
