"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { trapTab } from "./focus";

export type MenuItem = {
  type?: "item";
  id: string;
  label: string;
  icon?: ReactNode;
  kbd?: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
};

export type MenuSeparator = { type: "separator"; id: string };

export type MenuEntry = MenuItem | MenuSeparator;

type TriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

type MenuProps = {
  trigger: ReactElement<TriggerProps>;
  items: MenuEntry[];
  align?: "start" | "end";
};

function isItem(entry: MenuEntry): entry is MenuItem {
  return entry.type !== "separator";
}

export function Menu({ trigger, items, align = "end" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buffer = useRef("");
  const bufferTimer = useRef<number | null>(null);
  const menuId = useId();
  const enabled = items.filter(isItem).filter((item) => !item.disabled);

  const place = useCallback(
    (rect: DOMRect) => {
      const next = {
        top: rect.bottom + 4,
        left: align === "end" ? rect.right : rect.left,
      };
      setBox((current) =>
        current && current.top === next.top && current.left === next.left
          ? current
          : next,
      );
    },
    [align],
  );

  function closeMenu(restore = true) {
    if (restore) {
      rootRef.current?.querySelector<HTMLElement>("button")?.focus();
    }
    setOpen(false);
  }

  function move(delta: number) {
    if (enabled.length === 0) return;
    const index = Math.max(
      0,
      enabled.findIndex((item) => item.id === activeId),
    );
    const next = enabled[(index + delta + enabled.length) % enabled.length];
    setActiveId(next.id);
    document.getElementById(`${menuId}-${next.id}`)?.focus();
  }

  function select(item: MenuItem) {
    if (item.disabled) return;
    item.onSelect?.();
    closeMenu();
  }

  function onMenuKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      const first = enabled[0];
      if (first) {
        setActiveId(first.id);
        document.getElementById(`${menuId}-${first.id}`)?.focus();
      }
    } else if (event.key === "End") {
      event.preventDefault();
      const last = enabled[enabled.length - 1];
      if (last) {
        setActiveId(last.id);
        document.getElementById(`${menuId}-${last.id}`)?.focus();
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const item = enabled.find((entry) => entry.id === activeId);
      if (item) select(item);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    } else if (event.key === "Tab") {
      trapTab(event.nativeEvent, menuRef.current ?? event.currentTarget);
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      event.preventDefault();
      buffer.current = (buffer.current + event.key).toLowerCase();
      if (bufferTimer.current) window.clearTimeout(bufferTimer.current);
      bufferTimer.current = window.setTimeout(() => {
        buffer.current = "";
      }, 500);
      const match = enabled.find((item) =>
        item.label.toLowerCase().startsWith(buffer.current),
      );
      if (match) {
        setActiveId(match.id);
        document.getElementById(`${menuId}-${match.id}`)?.focus();
      }
    }
  }

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = rootRef.current?.querySelector("button");
    if (trigger) place(trigger.getBoundingClientRect());
    function onMove() {
      const current = rootRef.current?.querySelector("button");
      if (current) place(current.getBoundingClientRect());
    }
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const first = enabled[0];
    document.getElementById(first ? `${menuId}-${first.id}` : "")?.focus();
    function onPointer(event: globalThis.MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
    // enabled is derived from items; menu opens once per toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, menuId]);

  const triggerNode = cloneElement(trigger, {
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    "aria-controls": open ? menuId : undefined,
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      trigger.props.onClick?.(event);
      if (open) {
        setOpen(false);
        return;
      }
      place(event.currentTarget.getBoundingClientRect());
      setActiveId(enabled[0]?.id ?? null);
      setOpen(true);
    },
  });

  return (
    <div ref={rootRef} className="relative">
      {triggerNode}
      {open && box
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-orientation="vertical"
              onKeyDown={onMenuKey}
              style={{
                position: "fixed",
                top: box.top,
                left: align === "start" ? box.left : undefined,
                right:
                  align === "end"
                    ? Math.max(0, window.innerWidth - box.left)
                    : undefined,
              }}
              className="z-40 min-w-[180px] rounded-pop border border-line bg-bg p-1 shadow-pop"
            >
              {items.map((entry) =>
                entry.type === "separator" ? (
                  <div
                    key={entry.id}
                    role="separator"
                    className="my-1 h-px bg-line"
                  />
                ) : (
                  <button
                    key={entry.id}
                    id={`${menuId}-${entry.id}`}
                    type="button"
                    role="menuitem"
                    tabIndex={entry.id === activeId ? 0 : -1}
                    disabled={entry.disabled}
                    onClick={() => select(entry)}
                    onMouseEnter={() => {
                      if (!entry.disabled) setActiveId(entry.id);
                    }}
                    className={cn(
                      "flex h-9 w-full items-center gap-2 rounded-[4px] px-2 text-left text-[13px] leading-5",
                      entry.destructive ? "text-error" : "text-ink",
                      entry.id === activeId && "bg-fill-selected",
                      entry.disabled && "text-ink-disabled",
                    )}
                  >
                    {entry.icon ? (
                      <span className="text-current">{entry.icon}</span>
                    ) : (
                      <span className="size-4" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {entry.label}
                    </span>
                    {entry.kbd ? (
                      <span className="text-xs text-ink-3">{entry.kbd}</span>
                    ) : null}
                  </button>
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
