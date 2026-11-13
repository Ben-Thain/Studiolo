"use client";

import {
  cloneElement,
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
import { focusableElements } from "./focus";
import { placeFloating, type FloatingBox } from "./position";
import { useClient } from "./use-client";

export type MenuItem = {
  type?: "item";
  id: string;
  label: string;
  icon?: ReactNode;
  kbd?: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  forceState?: "hover" | "active" | "focus" | "disabled";
};

export type MenuSeparator = { type: "separator"; id: string };

export type MenuEntry = MenuItem | MenuSeparator;

type TriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

type MenuProps = {
  trigger: ReactElement<TriggerProps>;
  items: MenuEntry[];
  align?: "start" | "end";
  defaultOpen?: boolean;
  preview?: boolean;
};

function isItem(entry: MenuEntry): entry is MenuItem {
  return entry.type !== "separator";
}

function sameBox(current: FloatingBox | null, next: FloatingBox) {
  return (
    current?.top === next.top &&
    current.left === next.left &&
    current.maxHeight === next.maxHeight
  );
}

export function Menu({
  trigger,
  items,
  align = "end",
  defaultOpen = false,
  preview = false,
}: MenuProps) {
  const [open, setOpen] = useState(defaultOpen);
  const mounted = useClient();
  const skipFocus = useRef(defaultOpen);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [box, setBox] = useState<FloatingBox | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buffer = useRef("");
  const bufferTimer = useRef<number | null>(null);
  const menuId = useId();
  const generatedTriggerId = useId();
  const triggerId = trigger.props.id ?? generatedTriggerId;
  const enabled = items.filter(isItem).filter((item) => !item.disabled);

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

  function focusFromTrigger(backward: boolean) {
    const triggerButton = rootRef.current?.querySelector<HTMLElement>("button");
    if (!triggerButton) return;
    const itemsInPage = focusableElements(document.body).filter(
      (element) => !menuRef.current?.contains(element),
    );
    const index = itemsInPage.indexOf(triggerButton);
    const next = itemsInPage[index + (backward ? -1 : 1)];
    setOpen(false);
    next?.focus();
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
      event.preventDefault();
      focusFromTrigger(event.shiftKey);
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
    function update() {
      const anchor = rootRef.current?.querySelector("button");
      const panel = menuRef.current;
      if (!anchor || !panel) return;
      const next = placeFloating({
        trigger: anchor.getBoundingClientRect(),
        panel: { width: panel.offsetWidth, height: panel.offsetHeight },
        gap: 4,
        align,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });
      setBox((current) => (sameBox(current, next) ? current : next));
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, align, mounted]);

  const didFocus = useRef(false);

  useEffect(() => {
    if (!open) {
      didFocus.current = false;
      return;
    }
    if (!box || didFocus.current) return;
    didFocus.current = true;
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    const first = enabled[0];
    document.getElementById(first ? `${menuId}-${first.id}` : "")?.focus();
  }, [open, box, menuId, enabled]);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const triggerNode = cloneElement(trigger, {
    id: triggerId,
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    "aria-controls": open ? menuId : undefined,
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      trigger.props.onClick?.(event);
      if (open) {
        setOpen(false);
        return;
      }
      setActiveId(enabled[0]?.id ?? null);
      setOpen(true);
    },
  });

  if (preview) {
    return (
      <div className="w-[220px] rounded-pop border border-line bg-bg p-1">
        {items.map((entry) =>
          entry.type === "separator" ? (
            <div key={entry.id} className="my-1 h-px bg-line" />
          ) : (
            <button
              key={entry.id}
              type="button"
              role="menuitem"
              disabled={entry.disabled || entry.forceState === "disabled"}
              data-force-state={entry.forceState}
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-control-inner px-2 text-left text-[13px] leading-5",
                entry.disabled || entry.forceState === "disabled"
                  ? "text-ink-4"
                  : entry.destructive
                    ? "text-error"
                    : "text-ink",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            </button>
          ),
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {triggerNode}
      {open && mounted
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-orientation="vertical"
              aria-labelledby={triggerId}
              onKeyDown={onMenuKey}
              style={{
                position: "fixed",
                top: box?.top ?? 0,
                left: box?.left ?? 0,
                maxHeight: box?.maxHeight ?? "calc(100dvh - 16px)",
                visibility: box ? "visible" : "hidden",
                overflowY: "auto",
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
                    disabled={entry.disabled || entry.forceState === "disabled"}
                    data-force-state={entry.forceState}
                    onClick={() => select(entry)}
                    onMouseEnter={() => {
                      if (!entry.disabled) setActiveId(entry.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-control-inner px-2 text-left",
                      "h-11 text-base leading-6 sm:h-9 sm:text-[13px] sm:leading-5",
                      "active:bg-fill-selected",
                      entry.disabled || entry.forceState === "disabled"
                        ? "text-ink-4"
                        : entry.destructive
                          ? "text-error"
                          : "text-ink",
                      entry.id === activeId && !entry.disabled && "bg-fill-selected",
                    )}
                  >
                    {entry.icon ? (
                      <span className="inline-flex [&>svg]:size-5 sm:[&>svg]:size-4">
                        {entry.icon}
                      </span>
                    ) : (
                      <span className="size-5 sm:size-4" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
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
