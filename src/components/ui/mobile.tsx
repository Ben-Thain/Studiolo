import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

export function MobileNavBar({
  title,
  subtitle,
  onBack,
  onTitle,
  backLabel = "Back",
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onTitle?: () => void;
  backLabel?: string;
  action?: ReactNode;
}) {
  const titled = (
    <span className="block truncate text-base leading-5 font-medium text-ink">
      {title}
      {onTitle ? (
        <Icon
          name="chevron-down"
          size={14}
          className="ml-1 inline align-[-2px]"
        />
      ) : null}
    </span>
  );

  return (
    <header
      className={cn(
        "relative flex items-center border-b border-line bg-bg px-1",
        subtitle ? "min-h-14" : "h-11",
      )}
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex size-11 items-center justify-center text-ink"
      >
        <Icon name="chevron-left" size={20} />
        <span className="sr-only">{backLabel}</span>
      </button>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-12 text-center">
        {onTitle ? (
          <button
            type="button"
            onClick={onTitle}
            className="pointer-events-auto inline-flex min-h-11 max-w-full flex-col items-center justify-center"
          >
            {titled}
            {subtitle ? (
              <span className="block truncate text-xs leading-4 text-ink-3">
                {subtitle}
              </span>
            ) : null}
          </button>
        ) : (
          <h1>{titled}</h1>
        )}
      </div>
      <div className="ml-auto flex items-center">{action}</div>
    </header>
  );
}

export type MobileTab = {
  id: string;
  label: string;
  icon: IconName;
};

export function MobileTabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: MobileTab[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Sections"
      className="flex h-14 items-stretch border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs leading-4",
              selected ? "font-medium text-ink" : "font-normal text-ink-2",
            )}
          >
            <Icon name={tab.icon} size={20} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function MobileListRow({
  name,
  meta,
  trailing,
  onClick,
}: {
  name: string;
  meta?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 border-b border-line py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base leading-6 font-medium text-ink">
          {name}
        </span>
        {meta ? (
          <span className="block truncate text-[13px] leading-4 text-ink-3">
            {meta}
          </span>
        ) : null}
      </span>
      {trailing}
      <Icon name="chevron-right" size={16} className="text-ink-3" />
    </button>
  );
}
