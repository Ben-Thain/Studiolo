import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SidebarShell({
  header,
  children,
  footer,
  className,
}: {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-[240px] shrink-0 flex-col border-r border-line bg-bg",
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-line">{footer}</div>
      ) : null}
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
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-2 text-sm font-normal text-ink-2"
    >
      {children}
    </button>
  );
}

export function SidebarRow({
  icon,
  children,
  selected = false,
  onClick,
}: {
  icon?: ReactNode;
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-control px-2 text-left text-sm text-ink",
        selected
          ? "bg-fill-selected font-medium"
          : "font-normal hover:bg-fill-hover",
      )}
    >
      {icon ? <span className="text-ink-2">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </button>
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
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-bg">
        {initials}
      </span>
      <span className="truncate text-sm text-ink">{name}</span>
    </div>
  );
}
