"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
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
  bare?: boolean;
};

export function Segmented({
  label,
  value,
  options,
  onChange,
  bare = false,
}: SegmentedProps) {
  const baseId = useId();
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (!pending.current) return;
    const next = pending.current;
    pending.current = null;
    document.getElementById(`${baseId}-${next}`)?.focus();
  }, [value, baseId]);

  function move(nextIndex: number) {
    const next = options[nextIndex];
    if (!next || next.value === value) {
      document.getElementById(`${baseId}-${options[nextIndex]?.value ?? value}`)?.focus();
      return;
    }
    pending.current = next.value;
    onChange(next.value);
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move((index + 1) % options.length);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move((index - 1 + options.length) % options.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(options.length - 1);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={cn(
        "inline-flex h-8 items-center",
        bare
          ? ""
          : "rounded-control border border-line bg-bg p-0.5",
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            id={`${baseId}-${option.value}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-control-inner px-3 text-sm active:bg-fill-selected",
              bare ? "h-8" : "h-7",
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
