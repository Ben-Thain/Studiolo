"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";
import type { ControlSize } from "./field";

type Notice = "copied" | "error" | null;

type CopyFieldBase = {
  value: string;
  icon?: "globe" | "none";
  size?: ControlSize;
  touch?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  forceState?: "hover" | "focus";
};

type CopyFieldProps = CopyFieldBase &
  (
    | { label: string; "aria-label"?: string }
    | { label?: undefined; "aria-label": string }
  );

export function CopyField({
  value,
  label,
  icon = "globe",
  size,
  touch = false,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  forceState,
}: CopyFieldProps) {
  const resolved = size ?? (touch ? "touch" : undefined);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("copied");
    } catch {
      setNotice("error");
    }
  }

  const fieldHeight =
    resolved === "touch"
      ? "h-12 text-base"
      : resolved === "desktop"
        ? "h-8 text-sm"
        : "h-12 text-base sm:h-8 sm:text-sm";
  const buttonSize =
    resolved === "touch"
      ? "size-11"
      : resolved === "desktop"
        ? "size-7"
        : "size-11 sm:size-7";
  const iconSize = resolved === "desktop" ? 16 : resolved === "touch" ? 20 : 16;

  return (
    <>
    <div
      data-copy-field=""
      data-force-state={forceState}
      className={cn(
        "flex items-center gap-2 rounded-control border border-line bg-bg pl-3 pr-0.5 focus-within:border-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[rgba(10,10,10,0.4)]",
        fieldHeight,
      )}
    >
      {icon === "globe" ? (
        <Icon name="globe" size={16} className="text-ink-2" />
      ) : null}
      <input
        id={id}
        readOnly
        value={value}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={id ? undefined : (ariaLabel ?? label)}
        className="tabular min-w-0 flex-1 bg-transparent text-ink outline-none"
      />
      {notice ? (
        <span
          className={cn(
            "shrink-0 text-xs leading-4",
            notice === "error" ? "text-error" : "text-ink-2",
          )}
        >
          {notice === "copied" ? "Copied" : "Couldn't copy"}
        </span>
      ) : null}
      <button
        type="button"
        aria-label="Copy"
        onClick={copy}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-[var(--r-control-inner)] text-ink-2 hover:bg-fill-hover active:bg-fill-selected",
          buttonSize,
        )}
      >
        <Icon
          name={notice === "copied" ? "check" : "copy"}
          size={iconSize}
          className={resolved ? undefined : "size-5 sm:size-4"}
        />
      </button>
    </div>
    <span aria-live="polite" className="sr-only">
      {notice === "copied" ? "Copied" : notice === "error" ? "Couldn't copy" : ""}
    </span>
    </>
  );
}
