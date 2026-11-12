import { cn } from "@/lib/utils";

type SegmentedOption = {
  value: string;
  label: string;
};

type SegmentedProps = {
  label: string;
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
};

export function Segmented({
  label,
  value,
  options,
  onChange,
  bare = false,
}: SegmentedProps & { bare?: boolean }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex items-center",
        bare ? "h-7" : "h-8 rounded-control border border-line bg-bg p-0.5",
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 rounded-[4px] px-3 text-sm",
              selected
                ? "bg-fill-selected font-medium text-ink"
                : "font-normal text-ink-2 hover:bg-fill-hover",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
