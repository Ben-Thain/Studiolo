"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useClient } from "./use-client";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  message: string;
  action?: ToastAction;
  duration?: number;
  region?: string;
};

type ToastRecord = {
  id: string;
  message: string;
  action?: ToastAction;
  duration: number;
  region: string;
};

type ToastContextValue = {
  toasts: ToastRecord[];
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, number>());
  const deadlines = useRef(new Map<string, number>());
  const remaining = useRef(new Map<string, number>());
  const holds = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    deadlines.current.delete(id);
    remaining.current.delete(id);
    holds.current.delete(id);
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  const schedule = useCallback(
    (id: string, ms: number) => {
      const existing = timers.current.get(id);
      if (existing) window.clearTimeout(existing);
      remaining.current.set(id, ms);
      deadlines.current.set(id, Date.now() + ms);
      const timer = window.setTimeout(() => dismiss(id), ms);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = crypto.randomUUID();
      const duration = options.duration ?? 6000;
      const record: ToastRecord = {
        id,
        message: options.message,
        action: options.action,
        duration,
        region: options.region ?? "default",
      };
      setToasts((list) => [...list, record]);
      if (duration > 0) schedule(id, duration);
      return id;
    },
    [schedule],
  );

  const pause = useCallback((id: string) => {
    const count = (holds.current.get(id) ?? 0) + 1;
    holds.current.set(id, count);
    if (count > 1) return;
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    const left = Math.max(0, (deadlines.current.get(id) ?? Date.now()) - Date.now());
    remaining.current.set(id, left);
  }, []);

  const resume = useCallback(
    (id: string) => {
      const count = (holds.current.get(id) ?? 0) - 1;
      holds.current.set(id, Math.max(0, count));
      if (count > 0) return;
      const ms = remaining.current.get(id);
      if (ms === undefined || ms <= 0) return;
      schedule(id, ms);
    },
    [schedule],
  );

  const value = useMemo(
    () => ({ toasts, toast, dismiss, pause, resume }),
    [toasts, toast, dismiss, pause, resume],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

function ToastCard({ toast: item }: { toast: ToastRecord }) {
  const { dismiss, pause, resume } = useToast();
  return (
    <div
      data-toast=""
      onMouseEnter={() => pause(item.id)}
      onMouseLeave={() => resume(item.id)}
      onFocus={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        pause(item.id);
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        resume(item.id);
      }}
      className="on-ink pointer-events-auto flex w-full min-h-[52px] max-w-[560px] items-center gap-3 rounded-pop bg-ink px-4 py-3.5 text-sm leading-5 text-bg shadow-float sm:min-h-12 sm:w-auto sm:text-[13px] sm:leading-5"
    >
      <span className="min-w-0 flex-1">{item.message}</span>
      {item.action ? (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            dismiss(item.id);
          }}
          className="inline-flex h-8 shrink-0 items-center rounded-control px-3 text-[13px] leading-5 font-medium text-bg hover:bg-[rgba(255,255,255,0.08)]"
        >
          {item.action.label}
        </button>
      ) : null}
    </div>
  );
}

export function ToastRegion({
  id,
  offset = 0,
  contained = false,
  children,
  className,
}: {
  id: string;
  offset?: number;
  contained?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const { toasts } = useToast();
  const regionRef = useRef<HTMLDivElement>(null);
  const mounted = useClient();
  const [frame, setFrame] = useState<{ left: number; width: number } | null>(null);
  const [wide, setWide] = useState(false);
  const mine = toasts.filter((item) => item.region === id);

  useLayoutEffect(() => {
    if (contained) return;
    function measure() {
      const rect = regionRef.current?.getBoundingClientRect();
      setWide(window.innerWidth >= 640);
      if (!rect) return;
      setFrame((current) =>
        current && current.left === rect.left && current.width === rect.width
          ? current
          : { left: rect.left, width: rect.width },
      );
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [contained]);

  const cards = (
    <div className="flex w-full flex-col items-center gap-2">
      {mine.map((item) => (
        <ToastCard key={item.id} toast={item} />
      ))}
    </div>
  );

  const viewportStyle: CSSProperties = {
    ["--mobile-bottom-offset" as string]: `${offset}px`,
  };
  if (contained) {
    viewportStyle.bottom = `calc(8px + ${offset}px)`;
  } else if (wide && frame) {
    viewportStyle.left = frame.left;
    viewportStyle.width = frame.width;
  }

  const viewport = (
    <div
      role="status"
      aria-live="polite"
      data-toast-viewport={id}
      className={
        contained
          ? "pointer-events-none absolute inset-x-4 z-50 flex justify-center"
          : "toast-viewport"
      }
      style={viewportStyle}
    >
      {cards}
    </div>
  );

  return (
    <div
      ref={regionRef}
      data-toast-region={id}
      className={cn(contained && "relative", className)}
    >
      {children}
      {contained ? viewport : mounted ? createPortal(viewport, document.body) : null}
    </div>
  );
}

export function ToastViewport({
  id,
  offset,
  contained,
}: {
  id: string;
  offset?: number;
  contained?: boolean;
}) {
  return <ToastRegion id={id} offset={offset} contained={contained} />;
}
