"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";

type CopyFieldProps = {
  value: string;
  label?: string;
  icon?: "globe" | "none";
  touch?: boolean;
};

export function CopyField({
  value,
  label = "Copy",
  icon = "globe",
  touch = false,
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-control border border-line bg-bg px-3",
        touch ? "h-12 text-base" : "h-8 text-sm",
      )}
    >
      {icon === "globe" ? (
        <Icon name="globe" size={16} className="text-ink-2" />
      ) : null}
      <input
        readOnly
        value={value}
        aria-label={label === "Copy" ? value : label}
        className="tabular h-full min-w-0 flex-1 bg-transparent text-ink"
      />
      <button
        type="button"
        aria-label="Copy"
        onClick={copy}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-fill-hover",
          touch ? "size-11" : "size-6",
        )}
      >
        <Icon name={copied ? "check" : "copy"} size={16} />
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}
