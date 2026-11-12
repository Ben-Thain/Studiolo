"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  action?: ReactNode;
  duration?: number;
  mobile?: boolean;
};

export function Toast({
  open,
  onClose,
  children,
  action,
  duration = 6000,
  mobile = false,
}: ToastProps) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) remaining.current = duration;
  }, [open, duration]);

  useEffect(() => {
    if (!open || paused || duration === 0) return;
    const started = Date.now();
    const timer = window.setTimeout(
      () => onCloseRef.current(),
      remaining.current,
    );
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started),
      );
    };
  }, [open, paused, duration]);

  if (!open) return null;

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "flex items-center justify-between gap-4 rounded-pop bg-ink text-bg shadow-float",
        mobile
          ? "min-h-[52px] px-4 text-sm"
          : "h-12 px-4 text-[13px] leading-5",
      )}
    >
      <p>{children}</p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
