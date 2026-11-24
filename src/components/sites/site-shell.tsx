"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { MobileNavBar } from "@/components/ui/mobile";
import { Sheet } from "@/components/ui/sheet";
import {
  AccountRow,
  SidebarBack,
  SidebarRow,
  SidebarShell,
  TrialLine,
} from "@/components/ui/sidebar";
import { ToastRegion } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { SiteStatus, StatusDot } from "@/components/ui/top-bar";
import { TopBar } from "@/components/ui/top-bar";
import { SITES_COPY } from "@/lib/sites/copy";
import { cn } from "@/lib/utils";
import { useEditorHref } from "./editor-href";

export type SiteArea =
  "editor" | "pages" | "submissions" | "stats" | "settings";

export type ShellSite = {
  id: string;
  name: string;
  status: "live" | "draft";
  passwordOn: boolean;
  address: string;
  url: string;
};

const AREAS: { id: SiteArea; label: string; icon: IconName }[] = [
  { id: "editor", label: SITES_COPY.nav.editor, icon: "pencil" },
  { id: "pages", label: SITES_COPY.nav.pages, icon: "document" },
  { id: "submissions", label: SITES_COPY.nav.submissions, icon: "mail" },
  { id: "stats", label: SITES_COPY.nav.stats, icon: "chart" },
  { id: "settings", label: SITES_COPY.nav.settings, icon: "gear" },
];

function areaOf(pathname: string, siteId: string): SiteArea {
  const rest = pathname.slice(`/sites/${siteId}/`.length).split("/")[0];
  return (AREAS.find((area) => area.id === rest)?.id ?? "editor") as SiteArea;
}

function editorPageOf(pathname: string, siteId: string): string | null {
  const match = pathname.match(new RegExp(`^/sites/${siteId}/editor/([^/]+)`));
  return match ? match[1] : null;
}

/** Publish ⌄: the one top-bar primary. Prompt 09 adds the popover. */
function PublishButton({ size }: { size: "sm" | "nav" }) {
  return (
    <Tooltip label={SITES_COPY.publishSoon}>
      <Button size={size} chevron aria-disabled="true">
        {SITES_COPY.publish}
      </Button>
    </Tooltip>
  );
}

/**
 * The site shell (prompt 04a; d-pages.png, d-site-settings.png, d-editor.png):
 * the site sidebar (only "‹ Sites" at the top, five nav rows, Layers under
 * the nav on the Editor route only, trial line and account row) and the one
 * 56px site top bar (name + status + lock; Open editor except in the Editor;
 * Publish ⌄). Below 900px: the editor nav bar (back to Sites, the site name
 * opening the site menu, Publish).
 */
export function SiteShell({
  site,
  pages,
  homePageId,
  trialText,
  initials,
  accountName,
  children,
}: {
  site: ShellSite;
  pages: { id: string; title: string }[];
  homePageId: string;
  trialText: string;
  initials: string;
  accountName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const area = areaOf(pathname, site.id);
  const editorPage = editorPageOf(pathname, site.id);
  const editorHref = useEditorHref(
    site.id,
    homePageId,
    pages.map((page) => page.id),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const hrefOf = (id: SiteArea) =>
    id === "editor" ? editorHref : `/sites/${site.id}/${id}`;
  const pageTitle = pages.find((page) => page.id === editorPage)?.title;
  const statusLabel = site.status === "live" ? "Live" : "Draft";

  return (
    <div className="flex min-h-dvh flex-col min-[900px]:flex-row">
      <aside
        aria-label="Site"
        className="sticky top-0 hidden h-dvh shrink-0 min-[900px]:block"
      >
        <SidebarShell
          navLabel="Site"
          header={
            <SidebarBack as={Link} href="/sites">
              {SITES_COPY.back}
            </SidebarBack>
          }
          extra={
            area === "editor" ? (
              // Prompt 06 fills the layer tree for the open page.
              <div
                data-layers-slot=""
                className="-mx-2 mt-2 border-t border-line px-2 pt-2"
              >
                <div
                  data-layers-fallback=""
                  className="flex h-8 items-center gap-2 px-2 text-xs leading-4 text-ink-3"
                >
                  <span>Layers</span>
                  {pageTitle ? (
                    <span className="text-ink-2">{pageTitle}</span>
                  ) : null}
                </div>
              </div>
            ) : null
          }
          footer={
            <div className="pt-1 pb-1">
              <div className="pb-1">
                <TrialLine>{trialText}</TrialLine>
              </div>
              <AccountRow initials={initials} name={accountName} />
            </div>
          }
        >
          {AREAS.map((item) => (
            <SidebarRow
              key={item.id}
              as={Link}
              href={hrefOf(item.id)}
              selected={item.id === area}
              icon={<Icon name={item.icon} size={16} />}
            >
              {item.label}
            </SidebarRow>
          ))}
        </SidebarShell>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 hidden min-[900px]:block">
          <TopBar
            left={
              <>
                <SiteStatus
                  name={site.name}
                  status={site.status}
                  locked={site.passwordOn}
                />
                {area === "editor" ? (
                  <div data-editor-add="" className="flex items-center gap-2" />
                ) : null}
              </>
            }
            right={
              <>
                {area === "editor" ? (
                  <div
                    data-editor-status=""
                    className="flex items-center gap-2"
                  />
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    href={editorHref}
                    icon={<Icon name="pencil" size={14} />}
                  >
                    {SITES_COPY.openEditor}
                  </Button>
                )}
                <PublishButton size="sm" />
              </>
            }
          />
        </div>

        <div className="sticky top-0 z-20 min-[900px]:hidden">
          <MobileNavBar
            title={site.name}
            backHref="/sites"
            backLabel={SITES_COPY.backToSites}
            onTitle={() => setMenuOpen(true)}
            subtitle={
              area === "editor" && pageTitle ? (
                pageTitle
              ) : (
                <>
                  <StatusDot status={site.status} />
                  <span className="ml-1.5">{statusLabel}</span>
                  {site.passwordOn ? (
                    <span className="ml-1.5 inline-flex">
                      <Icon name="lock" size={12} />
                      <span className="sr-only">Password on</span>
                    </span>
                  ) : null}
                </>
              )
            }
            action={
              <span className="pr-1">
                <PublishButton size="nav" />
              </span>
            }
          />
        </div>

        <ToastRegion id="site" className="flex min-w-0 flex-1">
          <main
            className={cn(
              "min-w-0 flex-1",
              area === "editor"
                ? "flex bg-surface-2 p-0"
                : "px-6 pt-4 pb-10 min-[900px]:px-12 min-[900px]:pt-8",
            )}
          >
            {children}
          </main>
        </ToastRegion>
      </div>

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={site.name}
        meta={`${statusLabel} · ${site.address}`}
      >
        <nav aria-label="Site">
          <ul>
            {AREAS.map((item) => (
              <li key={item.id}>
                <Link
                  href={hrefOf(item.id)}
                  onClick={() => setMenuOpen(false)}
                  aria-current={item.id === area ? "page" : undefined}
                  className="flex h-14 items-center gap-4 border-b border-line text-base leading-6 text-ink"
                >
                  <Icon name={item.icon} size={20} className="text-ink-2" />
                  <span className="flex-1">{item.label}</span>
                  {item.id === area ? <Icon name="check" size={16} /> : null}
                </Link>
              </li>
            ))}
            {site.status === "live" ? (
              <li>
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener"
                  className="flex h-14 items-center gap-4 text-base leading-6 text-ink"
                >
                  <Icon name="external" size={20} className="text-ink-2" />
                  <span className="flex-1">{SITES_COPY.viewLive}</span>
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
      </Sheet>
    </div>
  );
}
