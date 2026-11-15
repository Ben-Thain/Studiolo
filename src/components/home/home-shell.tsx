"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/auth/wordmark";
import { Icon, type IconName } from "@/components/ui/icons";
import { MobileNavBar, MobileTabBar } from "@/components/ui/mobile";
import { ToastRegion } from "@/components/ui/toast";
import {
  AccountRow,
  SidebarRow,
  SidebarShell,
  SidebarWordmark,
  TrialLine,
} from "@/components/ui/sidebar";
import { HOME_COPY } from "@/lib/home/copy";

const NAV: { id: string; label: string; href: string; icon: IconName }[] = [
  { id: "sites", label: "Sites", href: "/sites", icon: "globe" },
  { id: "account", label: "Account", href: "/account", icon: "person" },
  { id: "plan", label: "Plan", href: "/plan", icon: "card" },
];

function current(pathname: string) {
  return (
    NAV.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.id ?? "sites"
  );
}

/**
 * The home shell (prompt 03): account-level only. Desktop (900px and up):
 * the 240px home sidebar with Sites, Account, Plan and the trial line and
 * account row at the bottom. Below 900px: the home nav bar and the tab bar.
 */
export function HomeShell({
  trialText,
  initials,
  name,
  children,
}: {
  trialText: string;
  initials: string;
  name: string;
  children: ReactNode;
}) {
  const selected = current(usePathname());

  return (
    <div className="flex min-h-dvh flex-col min-[900px]:flex-row">
      <aside
        aria-label="Home"
        className="sticky top-0 hidden h-dvh shrink-0 min-[900px]:block"
      >
        <SidebarShell
          navLabel="Home"
          header={
            <Link
              href="/sites"
              className="inline-flex min-h-10 items-center rounded-control"
            >
              <SidebarWordmark>Studiolo</SidebarWordmark>
            </Link>
          }
          footer={
            <div className="pt-1 pb-1">
              <div className="pb-1">
                <TrialLine>{trialText}</TrialLine>
              </div>
              <AccountRow initials={initials} name={name} />
            </div>
          }
        >
          {NAV.map((item) => (
            <SidebarRow
              key={item.id}
              as={Link}
              href={item.href}
              selected={item.id === selected}
              icon={<Icon name={item.icon} size={16} />}
            >
              {item.label}
            </SidebarRow>
          ))}
        </SidebarShell>
      </aside>

      <div className="sticky top-0 z-20 min-[900px]:hidden">
        <MobileNavBar
          variant="home"
          leading={<Wordmark />}
          action={
            selected === "sites" ? (
              <Link
                href="/sites?new=1"
                aria-label={HOME_COPY.newSite}
                className="inline-flex size-11 items-center justify-center rounded-control text-ink"
              >
                <Icon name="plus" size={20} />
              </Link>
            ) : null
          }
        />
      </div>

      <ToastRegion id="home" offset={56} className="flex min-w-0 flex-1">
        <main className="min-w-0 flex-1 px-6 pb-10 min-[900px]:px-12 min-[900px]:pt-10">
          {children}
        </main>
      </ToastRegion>

      <div className="sticky bottom-0 z-20 min-[900px]:hidden">
        <MobileTabBar
          value={selected}
          tabs={NAV.map(({ id, label, href, icon }) => ({
            id,
            label,
            href,
            icon,
          }))}
        />
      </div>
    </div>
  );
}
