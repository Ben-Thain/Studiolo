"use client";

import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { focusableElements, trapTab } from "./focus";
import { placeFloating, type FloatingBox } from "./position";

type PopoverProps = {
  open?: boolean;
  onClose?: () => void;
  trigger?: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
  children: ReactNode;
  align?: "start" | "end";
  label: string;
  panelClassName?: string;
  inline?: boolean;
};

function PopoverPanel({
  id,
  label,
  panelClassName,
  inline,
  box,
  panelRef,
  children,
}: {
  id?: string;
  label: string;
  panelClassName?: string;
  inline?: boolean;
  box?: FloatingBox | null;
  panelRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label={label}
      data-inline={inline ? "popover" : undefined}
      style={
        inline
          ? undefined
          : {
              position: "fixed",
              top: box?.top ?? 0,
              left: box?.left ?? 0,
              maxHeight: box?.maxHeight ?? "calc(100dvh - 16px)",
              visibility: box ? "visible" : "hidden",
              overflowY: "auto",
            }
      }
      className={cn(
        "z-40 w-[360px] max-w-[calc(100vw-16px)] rounded-pop border border-line bg-bg shadow-pop",
        panelClassName,
      )}
    >
      {children}
    </div>
  );
}

export function PopoverSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-line p-4", className)}>{children}</div>
  );
}

export function PopoverRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-10 items-center justify-between gap-4">
      <span className="shrink-0 text-xs leading-4 font-medium text-ink-2">
        {label}
      </span>
      <span className="min-w-0 truncate text-sm leading-5 text-ink-2">
        {children}
      </span>
    </div>
  );
}

export function Popover({
  open = false,
  onClose,
  trigger,
  children,
  align = "end",
  label,
  panelClassName,
  inline = false,
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [box, setBox] = useState<FloatingBox | null>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || inline) return;
    function update() {
      const anchor = rootRef.current?.querySelector("button");
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const next = placeFloating({
        trigger: anchor.getBoundingClientRect(),
        panel: { width: panel.offsetWidth, height: panel.offsetHeight },
        gap: 8,
        align,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });
      setBox((current) =>
        current &&
        current.top === next.top &&
        current.left === next.left &&
        current.maxHeight === next.maxHeight
          ? current
          : next,
      );
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, align, inline]);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || inline) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previously = document.activeElement as HTMLElement | null;
    const initial =
      panel.querySelector<HTMLElement>("[data-autofocus]") ??
      focusableElements(panel)[0];
    initial?.focus();
    function onKey(event: KeyboardEvent) {
      if (!panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
      } else {
        trapTab(event, panel);
      }
    }
    function onPointer(event: globalThis.MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      onCloseRef.current?.();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      previously?.focus();
    };
  }, [open, inline]);

  if (inline) {
    return (
      <PopoverPanel label={label} panelClassName={panelClassName} inline>
        {children}
      </PopoverPanel>
    );
  }

  const triggerNode = trigger
    ? cloneElement(trigger, {
        "aria-haspopup": "dialog" as const,
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
        onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
          trigger.props.onClick?.(event);
        },
      })
    : null;

  return (
    <div ref={rootRef} className="relative">
      {triggerNode}
      {open && typeof document !== "undefined"
        ? createPortal(
            <PopoverPanel
              id={id}
              label={label}
              panelClassName={panelClassName}
              box={box}
              panelRef={panelRef}
            >
              {children}
            </PopoverPanel>,
            document.body,
          )
        : null}
    </div>
  );
}
