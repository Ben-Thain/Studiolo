"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { focusableElements, trapTab } from "./focus";

type SheetProps = {
  open?: boolean;
  onClose?: () => void;
  title: string;
  meta?: string;
  children?: ReactNode;
  inline?: boolean;
};

function reducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function SheetPanel({
  title,
  meta,
  children,
  labelledBy,
  inline,
  panelRef,
  handleRef,
  offset,
  snapping,
}: {
  title: string;
  meta?: string;
  children?: ReactNode;
  labelledBy: string;
  inline?: boolean;
  panelRef?: Ref<HTMLDivElement>;
  handleRef?: Ref<HTMLDivElement>;
  offset?: number;
  snapping?: boolean;
}) {
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={inline ? undefined : true}
      aria-labelledby={labelledBy}
      data-inline={inline ? "sheet" : undefined}
      style={{ transform: offset ? `translateY(${offset}px)` : undefined }}
      className={cn(
        "rounded-t-sheet bg-bg shadow-dialog",
        snapping && "transition-transform duration-200 motion-reduce:transition-none",
      )}
    >
      <div
        ref={handleRef}
        data-sheet-handle=""
        className="px-6 pt-2 touch-none"
        style={{ touchAction: "none" }}
      >
        <div className="flex h-5 items-center justify-center">
          <span className="h-[5px] w-9 rounded-full bg-line" />
        </div>
        <h2 className="mt-1 text-lg leading-6 font-medium text-ink">
          {title}
        </h2>
        {meta ? (
          <p className="mt-1 text-sm leading-5 text-ink-3">{meta}</p>
        ) : null}
      </div>
      <div className="mx-6 mt-4 border-t border-line" />
      <div className="px-6 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}

export function Sheet({
  open = false,
  onClose,
  title,
  meta,
  children,
  inline = false,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const drag = useRef<{ y: number; time: number; pointer: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || inline) return;
    const panel = panelRef.current;
    const root = document.getElementById("app-root");
    const previously = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (root) root.setAttribute("inert", "");
    if (panel) {
      const initial =
        panel.querySelector<HTMLElement>("[data-autofocus]") ??
        focusableElements(panel)[0];
      initial?.focus();
    }
    function onKey(event: KeyboardEvent) {
      if (!panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
      } else {
        trapTab(event, panel);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      root?.removeAttribute("inert");
      previously?.focus();
    };
  }, [open, inline]);

  useEffect(() => {
    if (!open || inline) return;
    const handle = handleRef.current;
    const panel = panelRef.current;
    if (!handle || !panel) return;

    function finish(dy: number, dt: number) {
      const height = panel?.offsetHeight ?? 0;
      const velocity = dt > 0 ? dy / dt : 0;
      const shouldClose =
        dy > 96 || (height > 0 && dy > height * 0.25) || velocity > 0.5;
      if (shouldClose) {
        onCloseRef.current?.();
        setOffset(0);
        return;
      }
      if (reducedMotion()) {
        setOffset(0);
        return;
      }
      setSnapping(true);
      setOffset(0);
      window.setTimeout(() => setSnapping(false), 200);
    }

    function stop() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    }
    function onDown(event: PointerEvent) {
      if (event.button !== 0) return;
      try {
        handle?.setPointerCapture?.(event.pointerId);
      } catch {
        // jsdom does not implement pointer capture.
      }
      drag.current = { y: event.clientY, time: event.timeStamp, pointer: event.pointerId };
      setSnapping(false);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    }
    function onMove(event: PointerEvent) {
      if (!drag.current || drag.current.pointer !== event.pointerId) return;
      setOffset(Math.max(0, event.clientY - drag.current.y));
    }
    function onUp(event: PointerEvent) {
      if (!drag.current || drag.current.pointer !== event.pointerId) return;
      const dy = Math.max(0, event.clientY - drag.current.y);
      const dt = event.timeStamp - drag.current.time;
      drag.current = null;
      stop();
      finish(dy, dt > 0 ? dt : 0);
    }
    function onCancel(event: PointerEvent) {
      if (!drag.current || drag.current.pointer !== event.pointerId) return;
      drag.current = null;
      stop();
      finish(0, 1);
    }

    handle.addEventListener("pointerdown", onDown);
    return () => {
      handle.removeEventListener("pointerdown", onDown);
      stop();
    };
  }, [open, inline]);

  const panel = (
    <SheetPanel
      title={title}
      meta={meta}
      labelledBy={titleId}
      inline={inline}
      panelRef={inline ? undefined : panelRef}
      handleRef={inline ? undefined : handleRef}
      offset={offset}
      snapping={snapping}
    >
      {children}
    </SheetPanel>
  );

  if (inline) return panel;
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end">
      <div
        className="absolute inset-0 bg-[var(--scrim)]"
        onMouseDown={() => onClose?.()}
      />
      <div className="relative w-full">{panel}</div>
    </div>,
    document.body,
  );
}
