"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { focusableElements, trapTab } from "./focus";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  lead?: string;
  children?: ReactNode;
  actions?: ReactNode;
};

export function Dialog({
  open,
  onClose,
  title,
  lead,
  children,
  actions,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const leadId = useId();

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--scrim)]"
        onMouseDown={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={lead ? leadId : undefined}
        className="relative z-10 w-[440px] max-w-full rounded-dialog bg-bg p-6 shadow-dialog"
      >
        <h2 id={titleId} className="text-lg leading-6 font-medium text-ink">
          {title}
        </h2>
        {lead ? (
          <p id={leadId} className="mt-2 text-sm leading-5 text-ink-2">
            {lead}
          </p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        {actions ? (
          <div className="mt-6 flex items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
