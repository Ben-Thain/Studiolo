"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, type ForceState } from "@/components/ui/button";
import { StudioloCredit } from "@/components/ui/credit";
import { CopyField } from "@/components/ui/copy-field";
import { Dialog } from "@/components/ui/dialog";
import {
  EmptyState,
  GuideLine,
  InlineError,
  ReadoutChip,
  SelectionFrame,
  Skeleton,
  UndoChip,
} from "@/components/ui/feedback";
import {
  Field,
  Input,
  InputWithSuffix,
  LockedInput,
  Textarea,
} from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/components/ui/icons";
import { Menu, type MenuEntry } from "@/components/ui/menu";
import {
  MobileListRow,
  MobileNavBar,
  MobileTabBar,
} from "@/components/ui/mobile";
import { PageHead } from "@/components/ui/page-head";
import { Pill } from "@/components/ui/pill";
import { Popover, PopoverRow, PopoverSection } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import {
  AccountRow,
  SidebarBack,
  SidebarRow,
  SidebarShell,
  SidebarWordmark,
  TrialLine,
} from "@/components/ui/sidebar";
import { Stepper } from "@/components/ui/stepper";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToastRegion, ToastProvider, useToast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { SiteStatus, StatusDot, TopBar } from "@/components/ui/top-bar";
import { cn } from "@/lib/utils";

const siteMenu = (onDelete: () => void): MenuEntry[] => [
  {
    id: "duplicate",
    label: "Duplicate",
    icon: <Icon name="duplicate" size={16} />,
  },
  {
    id: "view",
    label: "View live",
    icon: <Icon name="external" size={16} />,
  },
  { type: "separator", id: "sep" },
  {
    id: "delete",
    label: "Delete",
    icon: <Icon name="trash" size={16} />,
    destructive: true,
    onSelect: onDelete,
  },
];

const edgeItems: MenuEntry[] = [
  { id: "duplicate", label: "Duplicate", icon: <Icon name="duplicate" size={16} /> },
  { id: "view", label: "View live", icon: <Icon name="external" size={16} /> },
  { type: "separator", id: "sep" },
  {
    id: "delete",
    label: "Delete",
    icon: <Icon name="trash" size={16} />,
    destructive: true,
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line px-4 py-8 sm:px-6">
      <h2 className="mb-4 text-sm leading-5 font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Shell({
  children,
  minWidth,
  height,
}: {
  children: ReactNode;
  minWidth: string;
  height: string;
}) {
  return (
    <div data-frame="desktop" className="w-full max-w-full overflow-x-auto">
      <div
        className={cn(
          "flex overflow-hidden rounded-dialog border border-line",
          minWidth,
          height,
        )}
      >
        {children}
      </div>
    </div>
  );
}

function HomeSidebar() {
  return (
    <SidebarShell
      navLabel="Main"
      header={<SidebarWordmark>Studiolo</SidebarWordmark>}
      footer={
        <>
          <TrialLine>Trial · 5 days left</TrialLine>
          <AccountRow initials="SC" name="Sam Carter" />
        </>
      }
    >
      <SidebarRow href="#sites" icon={<Icon name="sites" size={16} />} selected>
        Sites
      </SidebarRow>
      <SidebarRow href="#account" icon={<Icon name="person" size={16} />}>
        Account
      </SidebarRow>
      <SidebarRow href="#plan" icon={<Icon name="plan" size={16} />}>
        Plan
      </SidebarRow>
    </SidebarShell>
  );
}

function SiteSidebar() {
  return (
    <SidebarShell
      navLabel="Site"
      extra={<LayerTree />}
      header={<SidebarBack href="#sites">Sites</SidebarBack>}
      footer={
        <>
          <TrialLine>Trial · 5 days left</TrialLine>
          <AccountRow initials="SC" name="Sam Carter" />
        </>
      }
    >
      <SidebarRow href="#editor" icon={<Icon name="pencil" size={16} />} selected>
        Editor
      </SidebarRow>
      <SidebarRow href="#pages" icon={<Icon name="document" size={16} />}>
        Pages
      </SidebarRow>
      <SidebarRow href="#submissions" icon={<Icon name="inbox" size={16} />}>
        Submissions
      </SidebarRow>
      <SidebarRow href="#stats" icon={<Icon name="chart" size={16} />}>
        Stats
      </SidebarRow>
      <SidebarRow href="#settings" icon={<Icon name="sliders" size={16} />}>
        Settings
      </SidebarRow>
    </SidebarShell>
  );
}

function LayerTree() {
  return (
    <div>
      <div className="mt-4 flex h-8 items-center justify-between px-2 text-xs leading-4 text-ink-2">
        <span>Layers</span>
        <span className="inline-flex items-center gap-1 text-ink">
          Home
          <button
            type="button"
            aria-label="Add layer"
            className="inline-flex size-8 items-center justify-center rounded-control text-ink-2 hover:bg-fill-hover"
          >
            <Icon name="plus" size={16} />
          </button>
        </span>
      </div>
      <ul aria-label="Layers">
        <li>
          <button
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-fill-hover"
          >
            <Icon name="chevron-right" size={14} className="text-ink-3" />
            Header
          </button>
        </li>
        <li>
          <button
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-fill-hover"
          >
            <Icon name="chevron-down" size={14} className="text-ink-3" />
            Intro
          </button>
        </li>
        <li>
          <p className="flex h-8 items-center gap-2 pl-7 text-sm text-ink-2">Heading</p>
        </li>
        <li>
          <p className="flex h-8 items-center gap-2 pl-7 text-sm text-ink-2">Intro</p>
        </li>
        <li>
          <button
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-control bg-fill-selected px-2 pl-7 text-left text-sm font-medium"
          >
            <Icon name="image" size={16} className="text-ink-2" />
            Hero image
          </button>
        </li>
        <li>
          <button
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-fill-hover"
          >
            <Icon name="chevron-down" size={14} className="text-ink-3" />
            Projects
          </button>
        </li>
        {["Clifton, York", "Bootham Terrace", "Heworth Hall"].map((name) => (
          <li key={name}>
            <p className="flex h-8 items-center gap-2 pl-7 text-sm text-ink">
              <Icon name="image" size={16} className="text-ink-2" />
              {name}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusLabel({
  status,
  locked = false,
}: {
  status: "live" | "draft";
  locked?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-2">
      <StatusDot status={status} />
      {status === "live" ? "Live" : "Draft"}
      {locked ? <Icon name="lock" size={12} className="text-ink-2" /> : null}
    </span>
  );
}

function SiteActions({
  name,
  onDelete,
}: {
  name: string;
  onDelete: () => void;
}) {
  return (
    <Menu
      trigger={
        <IconButton label={`Actions for ${name}`} size="desktop">
          <Icon name="ellipsis" size={16} />
        </IconButton>
      }
      items={siteMenu(onDelete)}
    />
  );
}

function SitesTable({
  rows,
  onDelete,
}: {
  rows: Array<{
    name: string;
    status: "live" | "draft";
    locked?: boolean;
    domain: string;
    edited: string;
    highlight?: boolean;
  }>;
  onDelete?: () => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow header>
          <TableHead>Site</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Domain</TableHead>
          <TableHead>Last edited</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.name} highlight={row.highlight}>
            <TableCell className="text-sm leading-5 font-medium text-ink">
              {row.name}
            </TableCell>
            <TableCell>
              <StatusLabel status={row.status} locked={row.locked} />
            </TableCell>
            <TableCell className="tabular text-sm text-ink-2">{row.domain}</TableCell>
            <TableCell className="tabular text-sm text-ink-3">{row.edited}</TableCell>
            <TableCell className="w-12 text-right">
              {onDelete ? <SiteActions name={row.name} onDelete={onDelete} /> : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PublishBody({
  passwordOn,
  onPassword,
}: {
  passwordOn: boolean;
  onPassword: (checked: boolean) => void;
}) {
  return (
    <>
      <PopoverSection>
        <p className="text-sm leading-5 font-medium text-ink">Publish Riverton House</p>
        <p className="mt-1 truncate text-xs leading-4 text-ink-3">
          Last published 2 hours ago
        </p>
      </PopoverSection>
      <PopoverSection>
        <Field label="Live at">
          <CopyField value="rivertonhouse.co.uk" size="desktop" label="Live at" />
        </Field>
        <PopoverRow label="Domain">
          <span className="inline-flex items-center gap-1 text-ink">
            <Icon name="check" size={16} className="text-ink-2" />
            Connected
          </span>
        </PopoverRow>
        <PopoverRow label="Studiolo address">
          <span className="tabular whitespace-nowrap">
            riverton-house.studiolo.page
          </span>
        </PopoverRow>
      </PopoverSection>
      <PopoverSection>
        <div className="flex items-center justify-between">
          <span className="text-xs leading-4 font-medium text-ink-2">Password</span>
          <span className="inline-flex items-center gap-2 text-sm text-ink">
            {passwordOn ? "On" : "Off"}
            <Toggle
              checked={passwordOn}
              onChange={onPassword}
              label="Password"
              size="desktop"
            />
          </span>
        </div>
        <p className="mt-1 text-xs leading-4 text-ink-3">
          Visitors need the password before any page loads.
        </p>
      </PopoverSection>
      <div className="p-4">
        <Button size="lg" className="w-full">
          Publish
        </Button>
      </div>
    </>
  );
}

function MobilePublish({
  passwordOn,
  onPassword,
  onCancel,
}: {
  passwordOn: boolean;
  onPassword: (checked: boolean) => void;
  onCancel?: () => void;
}) {
  return (
    <div>
      <div className="border-b border-line pb-4">
        <Field label="Live at">
          <CopyField value="rivertonhouse.co.uk" size="touch" label="Live at" />
        </Field>
      </div>
      <div
        data-sheet-row=""
        className="flex h-14 items-center justify-between border-b border-line text-base leading-6"
      >
        <span>Domain</span>
        <span className="inline-flex items-center gap-1">
          <Icon name="check" size={16} />
          Connected
        </span>
      </div>
      <div
        data-sheet-row=""
        className="flex h-14 items-center justify-between border-b border-line text-base leading-6"
      >
        <span>Password</span>
        <span className="inline-flex items-center gap-2">
          {passwordOn ? "On" : "Off"}
          <Toggle
            checked={passwordOn}
            onChange={onPassword}
            label="Password"
            size="touch"
          />
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button size="touch" className="w-full">
          Publish
        </Button>
        <Button variant="secondary" size="touch" className="w-full" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const deleteLead =
  "Riverton House will go offline straight away. You can restore it from Recently deleted for 30 days.";

function DeleteSiteDialog({
  open = false,
  onClose,
  inline = false,
}: {
  open?: boolean;
  onClose?: () => void;
  inline?: boolean;
}) {
  const [name, setName] = useState("");
  const site = "Riverton House";
  return (
    <Dialog
      inline={inline}
      open={open}
      onClose={onClose}
      title={`Delete ${site}?`}
      lead={deleteLead}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={name !== site}
            onClick={onClose}
          >
            Delete site
          </Button>
        </>
      }
    >
      <div className="mt-4">
        <Field label={`Type ${site} to confirm`}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function GalleryToasts() {
  const { toast, dismiss } = useToast();
  useEffect(() => {
    const ids = [
      toast({
        region: "duplicated",
        message: "Duplicated North Light. The copy is a draft.",
        duration: 0,
        action: { label: "Open editor", onClick: () => undefined },
      }),
      toast({
        region: "deleted",
        message: "North Light deleted",
        duration: 0,
        action: { label: "Undo", onClick: () => undefined },
      }),
      toast({
        region: "mobile",
        message: "North Light deleted",
        duration: 0,
        action: { label: "Undo", onClick: () => undefined },
      }),
    ];
    return () => {
      ids.forEach((id) => dismiss(id));
    };
  }, [toast, dismiss]);
  return null;
}

const buttonStates: Array<{ label: string; forceState?: ForceState; disabled?: boolean; loading?: boolean }> = [
  { label: "Default" },
  { label: "Hover", forceState: "hover" },
  { label: "Focus", forceState: "focus" },
  { label: "Active", forceState: "active" },
  { label: "Disabled", disabled: true },
  { label: "Loading", loading: true },
];

export function Gallery() {
  return (
    <ToastProvider>
      <GalleryBody />
    </ToastProvider>
  );
}

function GalleryBody() {
  const { toast } = useToast();
  const [layout, setLayout] = useState("desktop");
  const [passwordOn, setPasswordOn] = useState(true);
  const [hideDesktop, setHideDesktop] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alt, setAlt] = useState(
    "Sitting room with oak panelling and a grey linen sofa",
  );
  const [link, setLink] = useState("");
  const [tab, setTab] = useState("sites");
  const [switchOn, setSwitchOn] = useState(true);
  const [segment, setSegment] = useState("desktop");

  const homeRows = [
    {
      name: "Riverton House",
      status: "live" as const,
      locked: true,
      domain: "rivertonhouse.co.uk",
      edited: "Today, 09:42",
    },
    {
      name: "North Light",
      status: "live" as const,
      domain: "north-light.studiolo.page",
      edited: "6 Nov",
    },
    {
      name: "Mara Lind",
      status: "draft" as const,
      domain: "mara-lind.studiolo.page",
      edited: "2 Nov",
    },
  ];

  return (
    <div data-gallery="" className="min-h-dvh bg-bg text-ink">
      <GalleryToasts />
      <div className="px-4 py-8 sm:px-6">
        <PageHead
          title="UI kit"
          lead="Dev gallery for the Mono tokens and app shell. Sample names stand in for later product data."
        />
      </div>

      <Section title="Home shell">
        <Shell minWidth="min-w-[960px]" height="h-[640px]">
          <HomeSidebar />
          <ToastRegion id="home" className="relative min-w-0 flex-1 bg-bg">
            <div className="px-8 pt-8">
              <PageHead
                title="Sites"
                lead="Open a site to edit it."
                action={
                  <Button size="desktop" icon={<Icon name="plus" size={16} />}>
                    New site
                  </Button>
                }
              />
              <SitesTable rows={homeRows} onDelete={() => setDialogOpen(true)} />
            </div>
          </ToastRegion>
        </Shell>
      </Section>

      <Section title="Duplicated site">
        <Shell minWidth="min-w-[960px]" height="h-[420px]">
          <HomeSidebar />
          <ToastRegion
            id="duplicated"
            contained
            size="desktop"
            className="relative min-w-0 flex-1"
          >
            <div className="px-8 pt-8">
              <PageHead
                title="Sites"
                lead="Open a site to edit it."
                action={
                  <Button size="desktop" icon={<Icon name="plus" size={16} />}>
                    New site
                  </Button>
                }
              />
              <SitesTable
                rows={[
                  {
                    name: "Copy of North Light",
                    status: "draft",
                    domain: "copy-of-north-light.studiolo.page",
                    edited: "Just now",
                    highlight: true,
                  },
                ]}
              />
            </div>
          </ToastRegion>
        </Shell>
      </Section>

      <Section title="Deleted site">
        <Shell minWidth="min-w-[960px]" height="h-[420px]">
          <HomeSidebar />
          <ToastRegion
            id="deleted"
            contained
            size="desktop"
            className="relative min-w-0 flex-1"
          >
            <div className="px-8 pt-8">
              <PageHead title="Sites" lead="Open a site to edit it." />
              <SitesTable
                rows={[
                  homeRows[0],
                  homeRows[2],
                ]}
              />
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 text-sm text-ink-3"
              >
                <Icon name="trash" size={16} />
                <span className="tabular">Recently deleted (1)</span>
                <Icon name="chevron-right" size={14} />
              </button>
            </div>
          </ToastRegion>
        </Shell>
      </Section>

      <Section title="Editor shell">
        <Shell minWidth="min-w-[1100px]" height="h-[720px]">
          <SiteSidebar />
          <div className="flex min-w-0 flex-1 flex-col bg-canvas">
            <TopBar
              left={
                <>
                  <SiteStatus name="Riverton House" status="live" locked />
                  <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
                  <Button
                    size="desktop"
                    variant="secondary"
                    icon={<Icon name="plus" size={16} />}
                  >
                    Add
                  </Button>
                </>
              }
              right={
                <>
                  <span className="px-1 text-sm text-ink-3">Saved</span>
                  <Button size="desktop" variant="secondary">
                    Preview
                  </Button>
                  <Popover
                    open={publishOpen}
                    onClose={() => setPublishOpen(false)}
                    label="Publish Riverton House"
                    trigger={
                      <Button
                        size="desktop"
                        chevron
                        onClick={() => setPublishOpen((open) => !open)}
                      >
                        Publish
                      </Button>
                    }
                  >
                    <PublishBody passwordOn={passwordOn} onPassword={setPasswordOn} />
                  </Popover>
                </>
              }
            />
            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-4 overflow-auto p-6">
                <div
                  data-picker=""
                  className="inline-flex h-8 items-center gap-1 rounded-control border border-line bg-bg p-0.5"
                >
                  <Menu
                    align="start"
                    trigger={
                      <button
                        type="button"
                        className="inline-flex h-[26px] items-center gap-1 rounded-[var(--r-control-inner)] px-3 text-sm font-medium"
                      >
                        Home
                        <Icon name="chevron-down" size={14} />
                      </button>
                    }
                    items={[
                      { id: "home", label: "Home" },
                      { id: "projects", label: "Projects" },
                      { id: "studio", label: "Studio" },
                      { id: "contact", label: "Contact" },
                    ]}
                  />
                  <span className="h-4 w-px bg-line" />
                  <Segmented
                    bare
                    compact
                    label="Layout"
                    value={layout}
                    onChange={setLayout}
                    options={[
                      { value: "desktop", label: "Desktop" },
                      { value: "mobile", label: "Mobile" },
                    ]}
                  />
                </div>
                <div className="w-full max-w-[720px] rounded-dialog bg-bg p-6">
                  <div className="mb-6 flex items-center justify-between text-sm">
                    <span className="font-medium">Riverton House</span>
                    <span className="flex gap-4 text-ink-2">
                      <span>Projects</span>
                      <span>Studio</span>
                      <span>Contact</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-2xl leading-8 font-medium tracking-[-0.02em]">
                        Interiors for old houses, done slowly.
                      </h3>
                      <p className="mt-3 text-sm leading-5 text-ink-2">
                        A small studio in York restoring Georgian and Victorian homes
                        since 2014.
                      </p>
                    </div>
                    <SelectionFrame className="min-h-[180px] bg-canvas">
                      <div className="flex h-[180px] items-end justify-center pb-3">
                        <ReadoutChip>480 × 360</ReadoutChip>
                      </div>
                    </SelectionFrame>
                  </div>
                  <div className="relative my-6">
                    <GuideLine />
                  </div>
                  <UndoChip
                    action={
                      <button type="button" className="font-medium text-bg">
                        Undo
                      </button>
                    }
                  >
                    Image resized
                  </UndoChip>
                </div>
              </div>
              <aside className="w-[280px] shrink-0 overflow-auto border-l border-line bg-bg">
                <div className="border-b border-line px-4 py-4">
                  <h2 className="text-sm leading-5 font-medium">Hero image</h2>
                  <p className="mt-1 text-xs leading-4 text-ink-3">Image · Intro section</p>
                </div>
                <div className="flex flex-col gap-4 px-4 py-4">
                  <div className="h-24 rounded-control bg-canvas" />
                  <Button size="desktop" variant="secondary" className="w-full">
                    Replace image
                  </Button>
                  <Field label="Alt text">
                    <Textarea
                      size="desktop"
                      value={alt}
                      onChange={(event) => setAlt(event.target.value)}
                    />
                  </Field>
                  <Field label="Link">
                    <Input
                      size="desktop"
                      value={link}
                      placeholder="Add a link"
                      onChange={(event) => setLink(event.target.value)}
                    />
                  </Field>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm">Hide on desktop</p>
                      <p className="mt-1 text-xs leading-4 text-ink-3">
                        Position and size are per layout. The image is shared.
                      </p>
                    </div>
                    <Toggle
                      size="desktop"
                      checked={hideDesktop}
                      onChange={setHideDesktop}
                      label="Hide on desktop"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-2 text-sm text-error"
                  >
                    <Icon name="trash" size={16} />
                    Delete from both layouts
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </Shell>
      </Section>

      <Section title="Publish popover">
        <Popover inline label="Publish Riverton House">
          <PublishBody passwordOn={passwordOn} onPassword={setPasswordOn} />
        </Popover>
      </Section>

      <Section title="Delete dialog">
        <DeleteSiteDialog inline />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open delete dialog
          </Button>
        </div>
      </Section>

      <Section title="Mobile">
        <div className="mb-4 flex flex-col gap-4">
          <div className="w-max max-w-full">
            <Menu
              inline
              defaultOpen
              align="start"
              trigger={
                <Button size="touch" variant="secondary">
                  Pinned left
                </Button>
              }
              items={edgeItems}
            />
          </div>
          <div className="ml-auto w-max max-w-full">
            <Menu
              inline
              defaultOpen
              align="end"
              trigger={
                <Button size="touch" variant="secondary">
                  Pinned right
                </Button>
              }
              items={edgeItems}
            />
          </div>
        </div>
        <div className="mb-4 flex items-center justify-between">
          <Menu
            align="end"
            trigger={
              <Button size="touch" variant="secondary">
                Left edge
              </Button>
            }
            items={edgeItems}
          />
          <Menu
            align="end"
            trigger={
              <Button size="touch" variant="secondary">
                Right edge
              </Button>
            }
            items={edgeItems}
          />
        </div>
        <div
          data-frame="mobile"
          className="relative mx-auto flex h-[852px] w-full max-w-[393px] flex-col overflow-hidden rounded-dialog border border-line"
        >
          <div className="min-h-0 flex-1 overflow-y-auto pb-[84px]">
            <MobileNavBar
              title="Riverton House"
              subtitle="Home"
              backLabel="Sites"
              onBack={() => undefined}
              onTitle={() => undefined}
              action={
                <Button size="nav">Publish</Button>
              }
            />
            <MobileNavBar
              variant="detail"
              title="Account"
              backLabel="Back"
              onBack={() => undefined}
            />
            <div className="bg-canvas px-6 py-6">
              <p className="text-sm font-medium">Riverton House</p>
              <p className="mt-4 text-[32px] leading-10 font-medium tracking-[-0.02em]">
                Interiors for old houses, done slowly.
              </p>
            </div>
            <Sheet
              inline
              title="Publish Riverton House"
              meta="Last published 10 Nov, 17:20"
            >
              <MobilePublish passwordOn={passwordOn} onPassword={setPasswordOn} />
            </Sheet>
            <div className="border-t border-line px-6">
              <MobileListRow
                name="Riverton House"
                meta="rivertonhouse.co.uk"
                trailing={<StatusLabel status="live" locked />}
              />
              <MobileListRow
                name="Mara Lind"
                meta="mara-lind.studiolo.page"
                trailing={<StatusLabel status="draft" />}
              />
            </div>
            <StudioloCredit />
            <div className="p-6">
              <Button variant="secondary" size="touch" onClick={() => setSheetOpen(true)}>
                Open publish sheet
              </Button>
            </div>
          </div>
          <ToastRegion
            id="mobile"
            contained
            size="mobile"
            offset={56}
            className="relative shrink-0"
          >
            <MobileTabBar
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "sites", label: "Sites", icon: "sites", href: "#sites" },
                { id: "account", label: "Account", icon: "person", href: "#account" },
                { id: "plan", label: "Plan", icon: "plan", href: "#plan" },
              ]}
            />
          </ToastRegion>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          {buttonStates.map((state) => (
            <Button
              key={state.label}
              forceState={state.forceState}
              disabled={state.disabled}
              loading={state.loading}
            >
              {state.label}
            </Button>
          ))}
          <Button variant="secondary">Secondary</Button>
          <Button variant="secondary" forceState="hover">
            Secondary hover
          </Button>
          <Button variant="secondary" forceState="active">
            Secondary active
          </Button>
          <Button variant="secondary" disabled>
            Secondary disabled
          </Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="ghost" disabled>
            Ghost disabled
          </Button>
          <Button variant="danger">Danger</Button>
          <Button variant="danger" disabled>
            Danger disabled
          </Button>
          <Button variant="destructive">Delete site</Button>
          <Button variant="destructive" forceState="hover">
            Delete hover
          </Button>
          <Button variant="destructive" disabled>
            Delete disabled
          </Button>
          <Button icon={<Icon name="plus" size={16} />}>Add</Button>
          <Button chevron>Publish</Button>
          <Button size="lg" variant="secondary">
            Large
          </Button>
          <Button size="touch">Touch</Button>
          <Button size="nav">Nav</Button>
          <IconButton label="More">
            <Icon name="ellipsis" size={16} />
          </IconButton>
          <IconButton label="More hover" forceState="hover">
            <Icon name="ellipsis" size={16} />
          </IconButton>
          <IconButton label="More active" forceState="active">
            <Icon name="ellipsis" size={16} />
          </IconButton>
          <IconButton label="More disabled" disabled>
            <Icon name="ellipsis" size={16} />
          </IconButton>
          <IconButton label="More options" size="touch">
            <Icon name="ellipsis" size={20} />
          </IconButton>
        </div>
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                region: "buttons",
                message: "Saved Riverton House",
                action: { label: "Open editor", onClick: () => undefined },
              })
            }
          >
            Show toast
          </Button>
        </div>
        <ToastRegion id="buttons" />
      </Section>

      <Section title="Fields">
        <div className="grid max-w-[440px] gap-4">
          <Field label="Site name" hint="Shown in the browser title.">
            <Input defaultValue="Riverton House" />
          </Field>
          <Field label="Site name" error="Enter a site name.">
            <Input defaultValue="" />
          </Field>
          <Field label="Notes">
            <Textarea defaultValue="" placeholder="Add a note" />
          </Field>
          <Field label="Slug">
            <LockedInput label="Slug" value="riverton-house" />
          </Field>
          <Field label="Live at">
            <CopyField value="rivertonhouse.co.uk" label="Live at" />
          </Field>
          <Field label="Address">
            <InputWithSuffix defaultValue="riverton-house" suffix=".studiolo.page" />
          </Field>
          <Field label="Domain">
            <InputWithSuffix
              defaultValue="rivertonhouse.co.uk"
              suffix={
                <span className="inline-flex items-center gap-1 text-ink-2">
                  <Icon name="check" size={16} />
                  Connected
                </span>
              }
            />
          </Field>
          <Input disabled defaultValue="Disabled field" aria-label="Disabled field" />
          <Input
            readOnly
            value="Focused field"
            aria-label="Focused field"
            data-force-state="focus"
          />
          <Input
            readOnly
            value="Hover field"
            aria-label="Hover field"
            data-force-state="hover"
          />
        </div>
      </Section>

      <Section title="Controls">
        <div className="flex flex-wrap items-center gap-6">
          <Toggle checked={switchOn} onChange={setSwitchOn} label="Password on" />
          <Toggle checked={false} onChange={() => undefined} label="Password off" />
          <Toggle
            checked={false}
            disabled
            onChange={() => undefined}
            label="Password disabled"
          />
          <Toggle
            checked
            disabled
            onChange={() => undefined}
            label="Password disabled on"
          />
          <Toggle
            checked={switchOn}
            size="touch"
            onChange={setSwitchOn}
            label="Password touch"
          />
          <Segmented
            label="Preview layout"
            value={segment}
            onChange={setSegment}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "mobile", label: "Mobile" },
            ]}
          />
          <Pill>Pending</Pill>
        </div>
        <div className="mt-6 overflow-x-auto">
          <Stepper
            steps={[
              { label: "Domain", state: "done" },
              { label: "DNS records", state: "current" },
              { label: "Check", state: "upcoming" },
            ]}
          />
        </div>
        <div className="mt-6 max-w-[280px]">
          <Menu
            trigger={<Button variant="secondary">Open menu</Button>}
            items={[
              {
                id: "duplicate",
                label: "Duplicate",
                icon: <Icon name="duplicate" size={16} />,
                kbd: "⌘D",
              },
              { id: "view", label: "View live" },
              { id: "rename", label: "Rename", disabled: true },
              { type: "separator", id: "sep" },
              {
                id: "delete",
                label: "Delete",
                icon: <Icon name="trash" size={16} />,
                destructive: true,
                disabled: true,
              },
            ]}
          />
        </div>
      </Section>

      <Section title="States">
        {(
          ["primary", "secondary", "ghost", "danger", "destructive"] as const
        ).map((variant) => (
          <div key={variant} className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant={variant}>{variant}</Button>
            <Button variant={variant} forceState="hover">
              {variant} hover
            </Button>
            <Button variant={variant} forceState="focus">
              {variant} focus
            </Button>
            <Button variant={variant} forceState="active">
              {variant} active
            </Button>
            <Button variant={variant} forceState="disabled">
              {variant} disabled
            </Button>
            <Button variant={variant} forceState="loading">
              {variant} loading
            </Button>
          </div>
        ))}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IconButton label="Icon default">
            <Icon name="ellipsis" size={16} />
          </IconButton>
          <IconButton label="Icon hover" forceState="hover">
            <Icon name="ellipsis" size={16} />
          </IconButton>
          <IconButton label="Icon focus" forceState="focus">
            <Icon name="ellipsis" size={16} />
          </IconButton>
          <IconButton label="Icon active" forceState="active">
            <Icon name="ellipsis" size={16} />
          </IconButton>
          <IconButton label="Icon disabled" forceState="disabled">
            <Icon name="ellipsis" size={16} />
          </IconButton>
        </div>
        <div className="mt-4 grid max-w-[440px] gap-3">
          <Input defaultValue="Name" aria-label="State field" />
          <Input defaultValue="Name" aria-label="State hover field" data-force-state="hover" />
          <Input defaultValue="Name" aria-label="State focus field" data-force-state="focus" />
          <Input defaultValue="" aria-label="State error field" data-force-state="error" aria-invalid />
          <Input defaultValue="Name" aria-label="State disabled field" data-force-state="disabled" disabled />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Toggle checked onChange={() => undefined} label="Toggle on" />
          <Toggle checked={false} onChange={() => undefined} label="Toggle off" />
          <Toggle checked onChange={() => undefined} label="Toggle on hover" forceState="hover" />
          <Toggle checked={false} onChange={() => undefined} label="Toggle off hover" forceState="hover" />
          <Toggle checked onChange={() => undefined} label="Toggle on active" forceState="active" />
          <Toggle checked={false} onChange={() => undefined} label="Toggle off active" forceState="active" />
          <Toggle checked onChange={() => undefined} label="Toggle on focus" forceState="focus" />
          <Toggle checked={false} onChange={() => undefined} label="Toggle off focus" forceState="focus" />
          <Toggle checked onChange={() => undefined} label="Toggle on disabled" forceState="disabled" />
          <Toggle checked={false} onChange={() => undefined} label="Toggle off disabled" forceState="disabled" />
          <Segmented
            label="State layout"
            value="desktop"
            onChange={() => undefined}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "mobile", label: "Mobile" },
            ]}
          />
          <Segmented
            label="State layout hover"
            forceState="hover"
            value="desktop"
            onChange={() => undefined}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "mobile", label: "Mobile" },
            ]}
          />
          <Segmented
            label="State layout focus"
            forceState="focus"
            value="desktop"
            onChange={() => undefined}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "mobile", label: "Mobile" },
            ]}
          />
          <Segmented
            label="State layout active"
            forceState="active"
            value="desktop"
            onChange={() => undefined}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "mobile", label: "Mobile" },
            ]}
          />
          <Segmented
            label="State layout disabled"
            forceState="disabled"
            value="desktop"
            onChange={() => undefined}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "mobile", label: "Mobile" },
            ]}
          />
        </div>
        <div className="mt-4 max-w-[240px]">
          <Menu
            inline
            defaultOpen
            trigger={<button type="button">Menu states</button>}
            items={[
              { id: "duplicate", label: "Duplicate", forceState: "active" },
              { id: "rename", label: "Rename", disabled: true, forceState: "disabled" },
            ]}
          />
        </div>
        <div className="mt-4 max-w-[240px]">
          <SidebarRow href="#sites">Sidebar</SidebarRow>
          <SidebarRow href="#hover" forceState="hover">
            Sidebar hover
          </SidebarRow>
          <SidebarRow href="#selected" selected>
            Sidebar selected
          </SidebarRow>
          <SidebarRow href="#focus" forceState="focus">
            Sidebar focus
          </SidebarRow>
        </div>
        <div className="mt-4 grid max-w-[440px] gap-3">
          <CopyField value="rivertonhouse.co.uk" label="Copy hover" forceState="hover" />
          <CopyField value="rivertonhouse.co.uk" label="Copy focus" forceState="focus" />
        </div>
      </Section>

      <Section title="Feedback">
        <EmptyState
          title="No submissions yet"
          lead="Messages from the site land here."
          action={<Button variant="secondary">Refresh</Button>}
        />
        <Skeleton rows={2} />
        <div className="mt-4">
          <InlineError onRetry={() => undefined}>Couldn’t load sites.</InlineError>
        </div>
        <p className="mt-6 text-[32px] leading-10 font-medium tabular">128</p>
      </Section>

      <DeleteSiteDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Publish Riverton House"
        meta="Last published 10 Nov, 17:20"
      >
        <MobilePublish
          passwordOn={passwordOn}
          onPassword={setPasswordOn}
          onCancel={() => setSheetOpen(false)}
        />
      </Sheet>
    </div>
  );
}
