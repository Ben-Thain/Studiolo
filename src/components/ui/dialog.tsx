"use client";

import { useEffect, useId, useRef, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { focusableElements, trapTab } from "./focus";
import { useClient } from "./use-client";

type DialogProps = {
  open?: boolean;
  onClose?: () => void;
  title: string;
  lead?: string;
  children?: ReactNode;
  actions?: ReactNode;
  inline?: boolean;
};

function DialogPanel({
  title,
  lead,
  children,
  actions,
  labelledBy,
  inline,
  panelRef,
}: {
  title: string;
  lead?: string;
  children?: ReactNode;
  actions?: ReactNode;
  labelledBy: string;
  inline?: boolean;
  panelRef?: Ref<HTMLDivElement>;
}) {
  const descriptionId = useId();
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={inline ? undefined : true}
      aria-labelledby={labelledBy}
      aria-describedby={lead ? descriptionId : undefined}
      data-inline={inline ? "dialog" : undefined}
      className="relative w-[440px] max-w-full rounded-dialog bg-bg p-6 shadow-dialog max-[479px]:w-[calc(100vw-32px)]"
    >
      <h2 id={labelledBy} className="text-lg leading-6 font-medium text-ink">
        {title}
      </h2>
      {lead ? (
        <p id={descriptionId} className="mt-2 text-sm leading-5 text-ink-2">
          {lead}
        </p>
      ) : null}
      {children}
      {actions ? (
        <div className="mt-6 flex justify-end gap-2 max-[479px]:flex-col max-[479px]:items-stretch [&>button]:max-[479px]:w-full">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function Dialog({
  open = false,
  onClose,
  title,
  lead,
  children,
  actions,
  inline = false,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  // Portals only exist in the browser; opening on first render (/sites?new=1)
  // must hydrate as "closed" and then open, or React reports a mismatch.
  const client = useClient();
  const shown = open && client;

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!shown || inline) return;
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
  }, [shown, inline]);

  if (inline) {
    return (
      <DialogPanel
        title={title}
        lead={lead}
        labelledBy={titleId}
        actions={actions}
        inline
      >
        {children}
      </DialogPanel>
    );
  }

  if (!shown) return null;

  return createPortal(
    // Centred; on desktop-sized screens the panel's top sits 200px down
    // (d-new-site.png, d-delete-site.png), so it doesn't jump as it grows.
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 [@media(min-width:900px)_and_(min-height:720px)]:items-start [@media(min-width:900px)_and_(min-height:720px)]:pt-[200px]">
      <div
        className="absolute inset-0 bg-[var(--scrim)]"
        onMouseDown={() => onClose?.()}
      />
      <DialogPanel
        title={title}
        lead={lead}
        labelledBy={titleId}
        actions={actions}
        panelRef={panelRef}
      >
        {children}
      </DialogPanel>
    </div>,
    document.body,
  );
}
