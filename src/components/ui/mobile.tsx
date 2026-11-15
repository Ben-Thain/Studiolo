import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

export function MobileNavBar({
  title,
  subtitle,
  onBack,
  backHref,
  onTitle,
  backLabel = "Back",
  action,
  leading,
  variant = "default",
}: {
  title?: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  /** A real link back (e.g. /sites) instead of an onBack callback. */
  backHref?: string;
  onTitle?: () => void;
  backLabel?: string;
  action?: ReactNode;
  /** "home" only: shown on the left (the wordmark). */
  leading?: ReactNode;
  /**
   * "home": the home tab screens (m-sites.png). 44px, no hairline, `leading`
   * left and `action` right; the screen title sits in the content below.
   */
  variant?: "default" | "detail" | "home";
}) {
  if (variant === "home") {
    return (
      <header className="flex h-11 items-center justify-between gap-2 bg-bg pr-5 pl-6">
        <div className="flex min-w-0 items-center">{leading}</div>
        {action ? <div className="flex items-center">{action}</div> : null}
      </header>
    );
  }
  const titled = (
    <span
      className={cn(
        "block truncate font-medium text-ink",
        variant === "detail" ? "text-base leading-6" : "text-base leading-5",
      )}
    >
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
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex size-11 items-center justify-center rounded-control text-ink"
        >
          <Icon name="chevron-left" size={20} />
          <span className="sr-only">{backLabel}</span>
        </Link>
      ) : onBack ? (
        variant === "detail" ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center gap-1 px-2 text-base leading-6 font-normal text-ink"
          >
            <Icon name="chevron-left" size={20} />
            {backLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex size-11 items-center justify-center text-ink"
          >
            <Icon name="chevron-left" size={20} />
            <span className="sr-only">{backLabel}</span>
          </button>
        )
      ) : (
        <span className="size-11" />
      )}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-12 text-center">
        {onTitle ? (
          <button
            type="button"
            onClick={onTitle}
            aria-haspopup="dialog"
            className="pointer-events-auto inline-flex min-h-11 max-w-full flex-col items-center justify-center rounded-control"
          >
            {titled}
            {subtitle ? (
              <span className="flex max-w-full items-center justify-center truncate text-xs leading-4 text-ink-3">
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
  href?: string;
};

export function MobileTabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: MobileTab[];
  value: string;
  onChange?: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Sections"
      className="flex min-h-[calc(56px+env(safe-area-inset-bottom))] items-stretch border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        const className = cn(
          "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs leading-4",
          selected ? "font-medium text-ink" : "font-normal text-ink-2",
        );
        const onClick = (event: { preventDefault: () => void }) => {
          if (onChange && !tab.href) event.preventDefault();
          onChange?.(tab.id);
        };
        const content = (
          <>
            <Icon name={tab.icon} size={20} />
            {tab.label}
          </>
        );
        if (!tab.href) {
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={onClick}
              className={className}
            >
              {content}
            </button>
          );
        }
        const internal = tab.href.startsWith("/") && !tab.href.startsWith("//");
        if (internal) {
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={selected ? "page" : undefined}
              onClick={onClick}
              className={className}
            >
              {content}
            </Link>
          );
        }
        return (
          <a
            key={tab.id}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            onClick={onClick}
            className={className}
          >
            {content}
          </a>
        );
      })}
    </nav>
  );
}

export function MobileListRow({
  name,
  meta,
  trailing,
  leading,
  href,
  onClick,
  id,
}: {
  id?: string;
  name: string;
  meta?: string;
  trailing?: ReactNode;
  /** A 16px slot before the text, e.g. a status dot. */
  leading?: ReactNode;
  /** Renders a next/link (an internal path) instead of a button. */
  href?: string;
  onClick?: () => void;
}) {
  const className = cn(
    "flex w-full items-center border-b border-line py-2 text-left",
    leading ? "min-h-16 gap-4" : "min-h-14 gap-3",
  );
  const content = (
    <>
      {leading ? (
        <span className="flex w-4 shrink-0 justify-center">{leading}</span>
      ) : null}
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
      <Icon name="chevron-right" size={16} className="shrink-0 text-ink-3" />
    </>
  );
  if (href) {
    return (
      <Link id={id} href={href} onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button id={id} type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
