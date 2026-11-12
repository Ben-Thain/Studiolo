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
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { focusableElements, trapTab } from "./focus";

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  trigger: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
  children: ReactNode;
  align?: "start" | "end";
  label: string;
  panelClassName?: string;
};

export function Popover({
  open,
  onClose,
  trigger,
  children,
  align = "end",
  label,
  panelClassName = "w-[320px]",
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const trigger = rootRef.current?.querySelector("button");
      const rect = trigger?.getBoundingClientRect();
      if (!rect) return;
      const next = {
        top: rect.bottom + 8,
        left: align === "end" ? rect.right : rect.left,
      };
      setBox((current) =>
        current && current.top === next.top && current.left === next.left
          ? current
          : next,
      );
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align]);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || !box) return;
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
        onCloseRef.current();
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
      onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      previously?.focus();
    };
  }, [open, box]);

  const triggerNode = cloneElement(trigger, {
    "aria-expanded": open,
    "aria-controls": open ? id : undefined,
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      trigger.props.onClick?.(event);
    },
  });

  return (
    <div ref={rootRef} className="relative">
      {triggerNode}
      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              id={id}
              role="dialog"
              aria-label={label}
              style={{
                position: "fixed",
                top: box.top,
                left: align === "start" ? box.left : undefined,
                right:
                  align === "end"
                    ? Math.max(0, window.innerWidth - box.left)
                    : undefined,
              }}
              className={cn(
                "z-40 rounded-pop border border-line bg-bg shadow-pop",
                panelClassName,
              )}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
