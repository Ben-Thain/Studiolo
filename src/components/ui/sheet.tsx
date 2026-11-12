"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { focusableElements, trapTab } from "./focus";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const drag = useRef<{ y: number } | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previously = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    focusableElements(panel ?? document.body)[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (!panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      } else {
        trapTab(event, panel);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previously?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-[var(--scrim)]"
        onMouseDown={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[90%] w-full overflow-y-auto rounded-t-sheet bg-bg pb-[max(16px,env(safe-area-inset-bottom))] shadow-dialog"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("[data-sheet-grabber]")) {
            drag.current = { y: event.clientY };
          }
        }}
        onPointerUp={(event) => {
          if (!drag.current) return;
          if (event.clientY - drag.current.y > 48) onCloseRef.current();
          drag.current = null;
        }}
      >
        <div data-sheet-grabber="" className="flex justify-center pt-2">
          <span className="h-[5px] w-9 rounded-full bg-line" />
        </div>
        <div className="px-4 pt-3">
          <h2 id={titleId} className="text-lg leading-6 font-medium text-ink">
            {title}
          </h2>
          {children}
        </div>
      </div>
    </div>
  );
}
