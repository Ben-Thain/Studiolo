import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";

export function SidebarHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
      {children}
    </div>
  );
}

export function SidebarFooter({ children }: { children: ReactNode }) {
  return <div className="shrink-0 border-t border-line">{children}</div>;
}

export function SidebarShell({
  header,
  children,
  extra,
  footer,
  navLabel,
  className,
}: {
  header: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  navLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-[240px] shrink-0 flex-col border-r border-line bg-bg",
        className,
      )}
    >
      <SidebarHeader>{header}</SidebarHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <nav aria-label={navLabel}>{children}</nav>
        {extra}
      </div>
      {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
    </div>
  );
}

export function SidebarWordmark({ children }: { children: ReactNode }) {
  return (
    <span className="text-base leading-5 font-medium tracking-[-0.02em] text-ink">
      {children}
    </span>
  );
}

export function SidebarBack({
  children,
  href = "#sites",
}: {
  children: ReactNode;
  href?: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex h-10 items-center gap-2 text-sm leading-5 font-normal text-ink-2"
    >
      <Icon name="chevron-left" size={16} />
      {children}
    </a>
  );
}

export function SidebarRow({
  icon,
  children,
  selected = false,
  href,
  as,
  forceState,
}: {
  icon?: ReactNode;
  children: ReactNode;
  selected?: boolean;
  href?: string;
  as?: ElementType;
  forceState?: "hover" | "focus" | "active";
}) {
  const className = cn(
    "flex h-10 w-full items-center gap-3 rounded-control px-2 text-left text-sm text-ink",
    selected
      ? "bg-fill-selected font-medium"
      : "font-normal hover:bg-fill-hover active:bg-fill-selected",
  );
  const content = (
    <>
      {icon ? <span className="text-ink-2">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </>
  );
  if (!href) {
    return (
      <button
        type="button"
        data-sidebar-row=""
        data-force-state={forceState}
        aria-current={selected ? "page" : undefined}
        className={className}
      >
        {content}
      </button>
    );
  }
  const Component = as ?? "a";
  return (
    <Component
      href={href}
      data-sidebar-row=""
      data-force-state={forceState}
      aria-current={selected ? "page" : undefined}
      className={className}
    >
      {content}
    </Component>
  );
}

export function TrialLine({ children }: { children: ReactNode }) {
  return <p className="px-4 pt-3 text-xs leading-4 text-ink-3">{children}</p>;
}

export function AccountRow({
  initials,
  name,
}: {
  initials: string;
  name: string;
}) {
  return (
    <div className="flex h-12 items-center gap-2 px-4">
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-ink text-xs leading-4 font-medium text-bg">
        {initials}
      </span>
      <span className="truncate text-sm text-ink">{name}</span>
    </div>
  );
}
