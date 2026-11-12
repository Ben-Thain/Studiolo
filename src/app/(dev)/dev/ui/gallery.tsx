"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
import { Popover } from "@/components/ui/popover";
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
import { Toast } from "@/components/ui/toast";
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line px-6 py-8">
      <h2 className="mb-4 text-sm leading-5 font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

function HomeSidebar() {
  return (
    <SidebarShell
      header={<SidebarWordmark>Studiolo</SidebarWordmark>}
      footer={
        <>
          <TrialLine>Trial · 5 days left</TrialLine>
          <AccountRow initials="SC" name="Sam Carter" />
        </>
      }
    >
      <SidebarRow icon={<Icon name="sites" size={16} />} selected>
        Sites
      </SidebarRow>
      <SidebarRow icon={<Icon name="person" size={16} />}>Account</SidebarRow>
      <SidebarRow icon={<Icon name="plan" size={16} />}>Plan</SidebarRow>
    </SidebarShell>
  );
}

function SiteSidebar() {
  return (
    <SidebarShell
      header={
        <SidebarBack>
          <Icon name="chevron-left" size={16} />
          Sites
        </SidebarBack>
      }
      footer={
        <>
          <TrialLine>Trial · 5 days left</TrialLine>
          <AccountRow initials="SC" name="Sam Carter" />
        </>
      }
    >
      <SidebarRow icon={<Icon name="pencil" size={16} />} selected>
        Editor
      </SidebarRow>
      <SidebarRow icon={<Icon name="document" size={16} />}>Pages</SidebarRow>
      <SidebarRow icon={<Icon name="inbox" size={16} />}>
        Submissions
      </SidebarRow>
      <SidebarRow icon={<Icon name="chart" size={16} />}>Stats</SidebarRow>
      <SidebarRow icon={<Icon name="sliders" size={16} />}>Settings</SidebarRow>
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
      <button
        type="button"
        className="flex h-8 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-fill-hover"
      >
        <Icon name="chevron-right" size={14} className="text-ink-3" />
        Header
      </button>
      <button
        type="button"
        className="flex h-8 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-fill-hover"
      >
        <Icon name="chevron-down" size={14} className="text-ink-3" />
        Intro
      </button>
      <p className="flex h-8 items-center gap-2 pl-7 text-sm text-ink-2">
        Heading
      </p>
      <p className="flex h-8 items-center gap-2 pl-7 text-sm text-ink-2">
        Intro
      </p>
      <button
        type="button"
        className="flex h-8 w-full items-center gap-2 rounded-control bg-fill-selected px-2 pl-7 text-left text-sm font-medium"
      >
        <Icon name="image" size={16} className="text-ink-2" />
        Hero image
      </button>
      <button
        type="button"
        className="flex h-8 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-fill-hover"
      >
        <Icon name="chevron-down" size={14} className="text-ink-3" />
        Projects
      </button>
      {["Clifton, York", "Bootham Terrace", "Heworth Hall"].map((name) => (
        <p
          key={name}
          className="flex h-8 items-center gap-2 pl-7 text-sm text-ink"
        >
          <Icon name="image" size={16} className="text-ink-2" />
          {name}
        </p>
      ))}
    </SidebarShell>
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
    <span className="inline-flex items-center gap-2 text-sm text-ink">
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
        <IconButton label={`Actions for ${name}`}>
          <Icon name="ellipsis" size={16} />
        </IconButton>
      }
      items={siteMenu(onDelete)}
    />
  );
}

function PublishPanel({
  mobile = false,
  passwordOn,
  onPassword,
}: {
  mobile?: boolean;
  passwordOn: boolean;
  onPassword: (checked: boolean) => void;
}) {
  return (
    <div>
      {mobile ? (
        <p className="border-b border-line px-4 py-3 text-xs leading-4 text-ink-3">
          Last published <span className="tabular">10 Nov, 17:20</span>
        </p>
      ) : (
        <div className="border-b border-line px-4 py-4">
          <p className="text-sm leading-5 font-medium text-ink">
            Publish Riverton House
          </p>
          <p className="mt-1 text-xs leading-4 text-ink-3">
            Last published <span className="tabular">10 Nov, 17:20</span>.
            Changes since then go live.
          </p>
        </div>
      )}
      <div
        className={cn("border-b border-line py-4", mobile ? "px-4" : "px-4")}
      >
        <Field label="Live at">
          <CopyField value="rivertonhouse.co.uk" touch={mobile} />
        </Field>
      </div>
      <div
        className={cn(
          "flex items-center justify-between border-b border-line text-sm",
          mobile ? "min-h-14 px-4" : "min-h-10 px-4",
        )}
      >
        <span>Domain</span>
        <span className="inline-flex items-center gap-1 text-ink">
          <Icon name="check" size={16} className="text-ink-2" />
          Connected
        </span>
      </div>
      {mobile ? null : (
        <div className="flex min-h-10 items-center justify-between gap-4 border-b border-line px-4 text-sm">
          <span className="shrink-0 text-ink-2">Studiolo address</span>
          <span className="tabular whitespace-nowrap text-ink">
            riverton-house.studiolo.page
          </span>
        </div>
      )}
      <div
        className={cn(
          "border-b border-line",
          mobile ? "flex min-h-14 items-center px-4" : "px-4 py-3",
        )}
      >
        <div className="flex w-full items-center justify-between text-sm">
          <span>Password</span>
          <span className="inline-flex items-center gap-2">
            {passwordOn ? "On" : "Off"}
            <Toggle
              checked={passwordOn}
              onChange={onPassword}
              label="Password"
              touch={mobile}
            />
          </span>
        </div>
        {mobile ? null : (
          <p className="mt-1 text-xs leading-4 text-ink-3">
            Visitors need the password before any page loads.
          </p>
        )}
      </div>
      <div className={mobile ? "px-4 pt-4" : "p-4"}>
        <Button size={mobile ? "touch" : "lg"} className="w-full">
          Publish
        </Button>
      </div>
    </div>
  );
}

const deleteLead =
  "Riverton House will go offline straight away. You can restore it from Recently deleted for 30 days.";

export function Gallery() {
  const [layout, setLayout] = useState("desktop");
  const [passwordOn, setPasswordOn] = useState(true);
  const [hideDesktop, setHideDesktop] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [alt, setAlt] = useState(
    "Sitting room with oak panelling and a grey linen sofa",
  );
  const [link, setLink] = useState("");
  const [tab, setTab] = useState("sites");
  const [toastOpen, setToastOpen] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [segment, setSegment] = useState("desktop");

  function closeDialog() {
    setDialogOpen(false);
  }

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="px-6 py-8">
        <PageHead
          title="UI kit"
          lead="Dev gallery for the Mono tokens and app shell. Sample names stand in for later product data."
        />
      </div>

      <Section title="Home shell">
        <div className="flex h-[640px] min-w-[960px] overflow-hidden rounded-dialog border border-line">
          <HomeSidebar />
          <div className="relative min-w-0 flex-1 bg-bg">
            <div className="px-8 pt-8">
              <PageHead
                title="Sites"
                lead="Open a site to edit it."
                action={
                  <Button icon={<Icon name="plus" size={16} />}>
                    New site
                  </Button>
                }
              />
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
                  <TableRow>
                    <TableCell className="text-sm font-medium">
                      Riverton House
                    </TableCell>
                    <TableCell>
                      <StatusLabel status="live" locked />
                    </TableCell>
                    <TableCell className="tabular text-sm">
                      rivertonhouse.co.uk
                    </TableCell>
                    <TableCell className="tabular text-sm text-ink-3">
                      Today, 09:42
                    </TableCell>
                    <TableCell className="w-12 text-right">
                      <SiteActions
                        name="Riverton House"
                        onDelete={() => setDialogOpen(true)}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-medium">
                      North Light
                    </TableCell>
                    <TableCell>
                      <StatusLabel status="live" />
                    </TableCell>
                    <TableCell className="tabular text-sm">
                      north-light.studiolo.page
                    </TableCell>
                    <TableCell className="tabular text-sm text-ink-3">
                      6 Nov
                    </TableCell>
                    <TableCell className="w-12 text-right">
                      <SiteActions
                        name="North Light"
                        onDelete={() => setDialogOpen(true)}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-medium">
                      Mara Lind
                    </TableCell>
                    <TableCell>
                      <StatusLabel status="draft" />
                    </TableCell>
                    <TableCell className="tabular text-sm">
                      mara-lind.studiolo.page
                    </TableCell>
                    <TableCell className="tabular text-sm text-ink-3">
                      2 Nov
                    </TableCell>
                    <TableCell className="w-12 text-right">
                      <SiteActions
                        name="Mara Lind"
                        onDelete={() => setDialogOpen(true)}
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Duplicated site">
        <div className="relative flex h-[420px] min-w-[960px] overflow-hidden rounded-dialog border border-line">
          <HomeSidebar />
          <div className="relative min-w-0 flex-1">
            <div className="px-8 pt-8">
              <PageHead
                title="Sites"
                lead="Open a site to edit it."
                action={
                  <Button icon={<Icon name="plus" size={16} />}>
                    New site
                  </Button>
                }
              />
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
                  <TableRow highlight>
                    <TableCell className="text-sm font-medium">
                      Copy of North Light
                    </TableCell>
                    <TableCell>
                      <StatusLabel status="draft" />
                    </TableCell>
                    <TableCell className="tabular text-sm">
                      copy-of-north-light.studiolo.page
                    </TableCell>
                    <TableCell className="tabular text-sm text-ink-3">
                      Just now
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
              <Toast
                open
                duration={0}
                onClose={() => undefined}
                action={
                  <button type="button" className="font-medium text-bg">
                    Open editor
                  </button>
                }
              >
                Duplicated North Light. The copy is a draft.
              </Toast>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Deleted site">
        <div className="relative flex h-[420px] min-w-[960px] overflow-hidden rounded-dialog border border-line">
          <HomeSidebar />
          <div className="relative min-w-0 flex-1">
            <div className="px-8 pt-8">
              <PageHead title="Sites" lead="Open a site to edit it." />
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-sm font-medium">
                      Riverton House
                    </TableCell>
                    <TableCell>
                      <StatusLabel status="live" locked />
                    </TableCell>
                    <TableCell className="tabular text-sm">
                      rivertonhouse.co.uk
                    </TableCell>
                    <TableCell className="tabular text-sm text-ink-3">
                      Today, 09:42
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-medium">
                      Mara Lind
                    </TableCell>
                    <TableCell>
                      <StatusLabel status="draft" />
                    </TableCell>
                    <TableCell className="tabular text-sm">
                      mara-lind.studiolo.page
                    </TableCell>
                    <TableCell className="tabular text-sm text-ink-3">
                      2 Nov
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 text-sm text-ink-3"
              >
                <Icon name="trash" size={16} />
                <span className="tabular">Recently deleted (1)</span>
                <Icon name="chevron-right" size={14} />
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-6 flex justify-center">
              <Toast
                open
                duration={0}
                onClose={() => undefined}
                action={
                  <button type="button" className="font-medium text-bg">
                    Undo
                  </button>
                }
              >
                North Light deleted
              </Toast>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Editor shell">
        <div className="flex h-[720px] min-w-[1100px] overflow-hidden rounded-dialog border border-line bg-canvas">
          <SiteSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar
              left={
                <>
                  <SiteStatus name="Riverton House" status="live" locked />
                  <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
                  <Button
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
                  <Button variant="secondary">Preview</Button>
                  <Popover
                    open={publishOpen}
                    onClose={() => setPublishOpen(false)}
                    label="Publish Riverton House"
                    panelClassName="w-[380px]"
                    trigger={
                      <Button
                        chevron
                        onClick={() => setPublishOpen((open) => !open)}
                      >
                        Publish
                      </Button>
                    }
                  >
                    <PublishPanel
                      passwordOn={passwordOn}
                      onPassword={setPasswordOn}
                    />
                  </Popover>
                </>
              }
            />
            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-4 overflow-auto p-6">
                <div className="inline-flex h-8 items-center rounded-control border border-line bg-bg p-0.5">
                  <Menu
                    align="start"
                    trigger={
                      <button
                        type="button"
                        className="inline-flex h-7 items-center gap-1 rounded-[4px] px-3 text-sm font-medium"
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
                  <Segmented
                    bare
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
                        A small studio in York restoring Georgian and Victorian
                        homes since 2014.
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
                  <p className="mt-1 text-xs leading-4 text-ink-3">
                    Image · Intro section
                  </p>
                </div>
                <div className="flex flex-col gap-4 px-4 py-4">
                  <div className="h-24 rounded-control bg-canvas" />
                  <Button variant="secondary" className="w-full">
                    Replace image
                  </Button>
                  <Field label="Alt text">
                    <Textarea
                      value={alt}
                      onChange={(event) => setAlt(event.target.value)}
                    />
                  </Field>
                  <Field label="Link">
                    <Input
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
        </div>
      </Section>

      <Section title="Publish popover">
        <div className="w-[380px] rounded-pop border border-line bg-bg shadow-pop">
          <PublishPanel passwordOn={passwordOn} onPassword={setPasswordOn} />
        </div>
      </Section>

      <Section title="Delete dialog">
        <div className="w-[440px] max-w-full rounded-dialog bg-bg p-6 shadow-dialog">
          <h3 className="text-lg leading-6 font-medium text-ink">
            Delete site
          </h3>
          <p className="mt-2 text-sm leading-5 text-ink-2">{deleteLead}</p>
          <div className="mt-4">
            <Field label="Type Riverton House to confirm">
              <Input defaultValue="" />
            </Field>
          </div>
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="secondary">Cancel</Button>
            <Button variant="destructive">Delete site</Button>
          </div>
        </div>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open delete dialog
          </Button>
        </div>
      </Section>

      <Section title="Mobile">
        <div className="w-[393px] max-w-full rounded-dialog border border-line">
          <MobileNavBar
            title="Riverton House"
            subtitle="Home"
            backLabel="Sites"
            onTitle={() => undefined}
            action={<Button>Publish</Button>}
          />
          <div className="bg-canvas px-4 py-6">
            <p className="text-sm font-medium">Riverton House</p>
            <p className="mt-4 text-[32px] leading-10 font-medium tracking-[-0.02em]">
              Interiors for old houses, done slowly.
            </p>
          </div>
          <div className="rounded-t-sheet bg-bg shadow-dialog">
            <div className="flex justify-center pt-2">
              <span className="h-[5px] w-9 rounded-full bg-line" />
            </div>
            <h3 className="px-4 pt-3 text-lg leading-6 font-medium">
              Publish Riverton House
            </h3>
            <PublishPanel
              mobile
              passwordOn={passwordOn}
              onPassword={setPasswordOn}
            />
            <div className="px-4 pb-4">
              <Button
                variant="secondary"
                size="touch"
                className="mt-3 w-full"
                onClick={() => setSheetOpen(true)}
              >
                Open publish sheet
              </Button>
            </div>
          </div>
          <div className="border-t border-line px-4">
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
          <MobileNavBar title="Account" backLabel="Back" />
          <MobileTabBar
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "sites", label: "Sites", icon: "sites" },
              { id: "account", label: "Account", icon: "person" },
              { id: "plan", label: "Plan", icon: "plan" },
            ]}
          />
          <StudioloCredit />
        </div>
        <div className="mt-6 w-[393px] max-w-full">
          <PageHead
            size="mobile"
            title="Sites"
            lead="Open a site to edit it."
          />
          <Toast
            open
            mobile
            duration={0}
            onClose={() => undefined}
            action={
              <button type="button" className="font-medium text-bg">
                Undo
              </button>
            }
          >
            North Light deleted
          </Toast>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="destructive">Delete site</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Saving</Button>
          <Button icon={<Icon name="plus" size={16} />}>Add</Button>
          <Button chevron>Publish</Button>
          <Button size="lg" variant="secondary">
            Large
          </Button>
          <Button size="touch">Touch</Button>
          <IconButton label="More">
            <Icon name="ellipsis" size={16} />
          </IconButton>
          <IconButton label="More options" size="touch">
            <Icon name="ellipsis" size={20} />
          </IconButton>
        </div>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setToastOpen(true)}>
            Show toast
          </Button>
        </div>
        {toastOpen ? (
          <div className="mt-4 flex justify-center">
            <Toast
              open={toastOpen}
              onClose={() => setToastOpen(false)}
              action={
                <button type="button" className="font-medium text-bg">
                  Open editor
                </button>
              }
            >
              Duplicated North Light. The copy is a draft.
            </Toast>
          </div>
        ) : null}
      </Section>

      <Section title="Fields">
        <div className="grid max-w-[440px] gap-4">
          <Field label="Site name" hint="Shown in the browser title.">
            <Input defaultValue="Riverton House" />
          </Field>
          <Field label="Site name" error="Enter a site name.">
            <Input defaultValue="" aria-invalid />
          </Field>
          <Field label="Notes">
            <Textarea defaultValue="" placeholder="Add a note" />
          </Field>
          <LockedInput label="Slug" value="riverton-house" />
          <Field label="Address">
            <InputWithSuffix
              defaultValue="riverton-house"
              suffix=".studiolo.page"
            />
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
          <CopyField value="rivertonhouse.co.uk" />
          <Input touch placeholder="Mobile input" aria-label="Mobile input" />
        </div>
      </Section>

      <Section title="Controls">
        <div className="flex flex-wrap items-center gap-6">
          <Toggle
            checked={switchOn}
            onChange={setSwitchOn}
            label="Password on"
          />
          <Toggle
            checked={false}
            onChange={() => undefined}
            label="Password off"
          />
          <Toggle
            checked={false}
            disabled
            onChange={() => undefined}
            label="Password disabled"
          />
          <Toggle
            checked={switchOn}
            touch
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
        <div className="mt-6">
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
              {
                id: "rename",
                label: "Rename",
                disabled: true,
              },
              { type: "separator", id: "sep" },
              {
                id: "delete",
                label: "Delete",
                icon: <Icon name="trash" size={16} />,
                destructive: true,
              },
            ]}
          />
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
          <InlineError onRetry={() => undefined}>
            Couldn’t load sites.
          </InlineError>
        </div>
        <p className="mt-6 text-[32px] leading-10 font-medium tabular">128</p>
      </Section>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title="Delete site"
        lead={deleteLead}
        actions={
          <>
            <Button variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={closeDialog}>
              Delete site
            </Button>
          </>
        }
      >
        <Field label="Type Riverton House to confirm">
          <Input
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
          />
        </Field>
      </Dialog>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Publish Riverton House"
      >
        <PublishPanel
          mobile
          passwordOn={passwordOn}
          onPassword={setPasswordOn}
        />
        <div className="px-4 pb-2">
          <Button
            variant="secondary"
            size="touch"
            className="w-full"
            onClick={() => setSheetOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
