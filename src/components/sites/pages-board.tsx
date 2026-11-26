"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { persistSiteDraft } from "@/app/(app)/sites/[siteId]/editor/actions";
import { applyCommand, type EditorCommand } from "@/editor/commands";
import { snapshotDoc, upsertChanges } from "@/editor/changes";
import type { DraftChanges } from "@/editor/schema";
import type { EditorDoc, EditorPage } from "@/editor/types";
import { AREA_COPY } from "@/lib/sites/copy";
import {
  derivePageSlug,
  isValidPageSlug,
  pageSlugError,
} from "@/lib/sites/page-slug";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import { PageHead } from "@/components/ui/page-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";

function sortedPages(doc: EditorDoc): EditorPage[] {
  return [...doc.pages].sort((a, b) => a.sortOrder - b.sortOrder);
}

function pagePath(page: EditorPage): string {
  return page.isHome ? "/" : `/${page.slug}`;
}

export function PagesBoard({
  initialDoc,
  published,
}: {
  initialDoc: EditorDoc;
  published: boolean;
}) {
  const router = useRouter();
  const [doc, setDoc] = useState(initialDoc);
  const [order, setOrder] = useState(() =>
    sortedPages(initialDoc).map((page) => page.id),
  );
  const [lifted, setLifted] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<
    | { kind: "new" }
    | { kind: "rename"; pageId: string }
    | { kind: "delete"; pageId: string }
    | null
  >(null);
  const retry = useRef<(() => Promise<void>) | null>(null);
  const orderBeforeLift = useRef<string[] | null>(null);
  const dragging = useRef<string | null>(null);
  const orderRef = useRef(order);

  const pages = useMemo(() => {
    const byId = new Map(doc.pages.map((page) => [page.id, page]));
    return order
      .map((id) => byId.get(id))
      .filter((page): page is EditorPage => Boolean(page));
  }, [doc.pages, order]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    if (lifted || dragging.current) return;
    setOrder(sortedPages(doc).map((page) => page.id));
  }, [doc, lifted]);

  async function persist(next: EditorDoc, changes: DraftChanges) {
    setSaving(true);
    setError(null);
    const result = await persistSiteDraft({
      siteId: next.siteId,
      expectedRevision: doc.revision,
      changes,
    });
    setSaving(false);
    if (!result.ok) {
      setError("Could not save this change.");
      return false;
    }
    next.revision = result.revision;
    setDoc(next);
    router.refresh();
    return true;
  }

  async function run(command: EditorCommand) {
    const attempt = async () => {
      const result = applyCommand(doc, command);
      await persist(result.doc, result.changes);
    };
    retry.current = attempt;
    await attempt();
  }

  function announce(page: EditorPage, index: number, verb?: string) {
    const place = `position ${index + 1} of ${pages.length}`;
    setLive(
      verb ? `${page.title} ${verb}, ${place}` : `${page.title}, ${place}`,
    );
  }

  function moveLifted(delta: number) {
    if (!lifted) return;
    setOrder((current) => {
      const index = current.indexOf(lifted);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const copy = [...current];
      const [id] = copy.splice(index, 1);
      copy.splice(next, 0, id);
      const page = doc.pages.find((item) => item.id === id);
      if (page) {
        setLive(`${page.title}, position ${next + 1} of ${copy.length}`);
      }
      return copy;
    });
  }

  async function dropLifted() {
    if (!lifted) return;
    const page = doc.pages.find((item) => item.id === lifted);
    const index = order.indexOf(lifted);
    setLifted(null);
    orderBeforeLift.current = null;
    if (page) announce(page, index, "dropped");
    const saved = sortedPages(doc).map((item) => item.id);
    if (saved.join() === order.join()) return;
    await run({ type: "reorderPages", pageId: lifted, sortOrder: index });
  }

  function cancelLift() {
    if (!lifted) return;
    const previous = orderBeforeLift.current;
    if (previous) setOrder(previous);
    setLifted(null);
    orderBeforeLift.current = null;
    setLive("Reorder cancelled");
  }

  function onGripKey(page: EditorPage, event: KeyboardEvent) {
    if (event.key === " ") {
      event.preventDefault();
      if (lifted === page.id) {
        void dropLifted();
        return;
      }
      orderBeforeLift.current = order;
      setLifted(page.id);
      announce(page, order.indexOf(page.id), "lifted");
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelLift();
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (lifted !== page.id) return;
      moveLifted(event.key === "ArrowUp" ? -1 : 1);
    }
  }

  function onGripPointerDown(pageId: string, event: PointerEvent) {
    dragging.current = pageId;
    orderBeforeLift.current = order;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onGripPointerMove(event: PointerEvent) {
    const id = dragging.current;
    if (!id) return;
    const rows = [
      ...document.querySelectorAll<HTMLElement>("[data-page-row]"),
    ].filter((row) => row.getClientRects().length > 0);
    let target = -1;
    rows.forEach((row, index) => {
      const box = row.getBoundingClientRect();
      if (event.clientY >= box.top && event.clientY <= box.bottom)
        target = index;
    });
    if (target < 0) return;
    setOrder((current) => {
      const from = current.indexOf(id);
      if (from < 0 || from === target) return current;
      const copy = [...current];
      const [moved] = copy.splice(from, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
  }

  async function onGripPointerUp() {
    const id = dragging.current;
    dragging.current = null;
    if (!id) return;
    const current = orderRef.current;
    const index = current.indexOf(id);
    const saved = sortedPages(doc).map((item) => item.id);
    if (saved.join() === current.join()) return;
    await run({ type: "reorderPages", pageId: id, sortOrder: index });
  }

  async function createPage(title: string, slug: string) {
    const before = snapshotDoc(doc);
    const added = applyCommand(doc, {
      type: "addPage",
      title,
      slug,
      inNav: true,
    });
    const known = new Set(doc.pages.map((page) => page.id));
    const page = added.doc.pages.find((item) => !known.has(item.id));
    if (!page) {
      setError("Could not create this page.");
      return;
    }
    const withSection = applyCommand(added.doc, {
      type: "addSection",
      pageId: page.id,
      name: "Main",
    });
    const changes = upsertChanges(withSection.doc, before);
    retry.current = async () => {
      await createPage(title, slug);
    };
    const ok = await persist(withSection.doc, changes);
    if (ok) router.push(`/sites/${doc.siteId}/editor/${page.id}`);
  }

  const newButton = (
    <Button
      variant="secondary"
      size="desktop"
      icon={<Icon name="plus" size={14} />}
      onClick={() => setDialog({ kind: "new" })}
    >
      New page
    </Button>
  );

  return (
    <>
      <PageHead
        size="responsive"
        title={AREA_COPY.pagesTitle}
        lead={AREA_COPY.pagesLead}
        action={newButton}
      />
      <div className="mb-4 min-[900px]:hidden">{newButton}</div>
      <p data-pages-live="" aria-live="polite" className="sr-only">
        {live}
      </p>
      {error ? (
        <p
          role="alert"
          className="mb-4 flex items-center gap-3 text-sm text-error"
        >
          {error}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void retry.current?.()}
          >
            Retry
          </Button>
        </p>
      ) : null}
      <Table className="hidden max-w-[944px] table-fixed min-[900px]:table">
        <colgroup>
          <col className="w-10" />
          <col />
          <col className="w-[220px]" />
          <col className="w-[120px]" />
          <col className="w-12" />
        </colgroup>
        <TableHeader>
          <TableRow header>
            <TableHead>
              <span className="sr-only">Reorder</span>
            </TableHead>
            <TableHead>{AREA_COPY.page}</TableHead>
            <TableHead>{AREA_COPY.pageAddress}</TableHead>
            <TableHead>{AREA_COPY.inMenu}</TableHead>
            <TableHead>
              <span className="sr-only">Menu</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((page) => (
            <TableRow
              key={page.id}
              data-page-row={page.id}
              className="h-12"
              highlight={lifted === page.id}
            >
              <TableCell className="h-12 w-10 pr-0">
                <Grip
                  page={page}
                  lifted={lifted === page.id}
                  disabled={saving}
                  onKeyDown={(event) => onGripKey(page, event)}
                  onPointerDown={(event) => onGripPointerDown(page.id, event)}
                  onPointerMove={onGripPointerMove}
                  onPointerUp={() => void onGripPointerUp()}
                />
              </TableCell>
              <TableCell className="h-12 text-sm leading-5 font-medium text-ink">
                {page.title}
                {page.isHome ? <HomeBadge /> : null}
              </TableCell>
              <TableCell className="h-12 text-sm leading-5 text-ink-3">
                {pagePath(page)}
              </TableCell>
              <TableCell className="h-12">
                <Toggle
                  size="desktop"
                  checked={page.inNav}
                  label={`${page.title} in menu`}
                  disabled={saving}
                  onChange={(checked) =>
                    void run({
                      type: "setInNav",
                      pageId: page.id,
                      inNav: checked,
                    })
                  }
                />
              </TableCell>
              <TableCell className="h-12 pr-0 text-right">
                <PageMenu
                  page={page}
                  disabled={saving}
                  onOpen={() =>
                    router.push(`/sites/${doc.siteId}/editor/${page.id}`)
                  }
                  onRename={() =>
                    setDialog({ kind: "rename", pageId: page.id })
                  }
                  onHome={() => void run({ type: "setHome", pageId: page.id })}
                  onDelete={() =>
                    setDialog({ kind: "delete", pageId: page.id })
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ul className="min-[900px]:hidden">
        {pages.map((page) => (
          <li
            key={page.id}
            data-page-row={page.id}
            className="flex min-h-16 items-center gap-3 border-b border-line py-2"
          >
            <Grip
              page={page}
              lifted={lifted === page.id}
              disabled={saving}
              onKeyDown={(event) => onGripKey(page, event)}
              onPointerDown={(event) => onGripPointerDown(page.id, event)}
              onPointerMove={onGripPointerMove}
              onPointerUp={() => void onGripPointerUp()}
            />
            <div className="min-w-0 flex-1">
              <div className="text-base leading-6 font-medium text-ink">
                {page.title}
                {page.isHome ? <HomeBadge /> : null}
              </div>
              <div className="text-[13px] leading-4 text-ink-3">
                {pagePath(page)}
              </div>
            </div>
            <Toggle
              checked={page.inNav}
              label={`${page.title} in menu`}
              disabled={saving}
              onChange={(checked) =>
                void run({ type: "setInNav", pageId: page.id, inNav: checked })
              }
            />
            <PageMenu
              page={page}
              disabled={saving}
              onOpen={() =>
                router.push(`/sites/${doc.siteId}/editor/${page.id}`)
              }
              onRename={() => setDialog({ kind: "rename", pageId: page.id })}
              onHome={() => void run({ type: "setHome", pageId: page.id })}
              onDelete={() => setDialog({ kind: "delete", pageId: page.id })}
            />
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-4 text-ink-3">{AREA_COPY.pagesNote}</p>
      {dialog?.kind === "new" ? (
        <PageFormDialog
          title="New page"
          submitLabel="Create page"
          pages={doc.pages}
          published={published}
          onClose={() => setDialog(null)}
          onSubmit={async (title, slug) => {
            setDialog(null);
            await createPage(title, slug);
          }}
        />
      ) : null}
      {dialog?.kind === "rename" ? (
        <PageFormDialog
          title="Rename"
          submitLabel="Save"
          pages={doc.pages}
          published={published}
          page={doc.pages.find((page) => page.id === dialog.pageId)}
          onClose={() => setDialog(null)}
          onSubmit={async (title, slug) => {
            const pageId = dialog.pageId;
            setDialog(null);
            await run({
              type: "updatePage",
              pageId,
              patch: { title, slug },
            });
          }}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <DeletePageDialog
          page={doc.pages.find((page) => page.id === dialog.pageId)}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const pageId = dialog.pageId;
            setDialog(null);
            await run({ type: "deletePage", pageId });
          }}
        />
      ) : null}
    </>
  );
}

function HomeBadge() {
  return (
    <span className="ml-2 inline-flex h-5 items-center rounded-[4px] border border-line px-1.5 text-xs leading-4 font-normal text-ink-2">
      {AREA_COPY.home}
    </span>
  );
}

function Grip({
  page,
  lifted,
  disabled,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  page: EditorPage;
  lifted: boolean;
  disabled: boolean;
  onKeyDown: (event: KeyboardEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Reorder ${page.title}`}
      aria-grabbed={lifted}
      disabled={disabled}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="inline-flex size-11 items-center justify-center rounded-control text-ink-4 hover:text-ink-2 min-[900px]:size-8"
    >
      <Icon name="grip" size={16} />
    </button>
  );
}

function PageMenu({
  page,
  disabled,
  onOpen,
  onRename,
  onHome,
  onDelete,
}: {
  page: EditorPage;
  disabled: boolean;
  onOpen: () => void;
  onRename: () => void;
  onHome: () => void;
  onDelete: () => void;
}) {
  return (
    <Menu
      trigger={
        <button
          type="button"
          aria-label={`Menu for ${page.title}`}
          disabled={disabled}
          className="inline-flex size-11 items-center justify-center rounded-control text-ink-2 hover:bg-fill-hover min-[900px]:size-8"
        >
          <Icon name="ellipsis" size={16} />
        </button>
      }
      items={[
        { id: "open", label: "Open in editor", onSelect: onOpen },
        { id: "rename", label: "Rename", onSelect: onRename },
        {
          id: "home",
          label: "Set as home",
          disabled: page.isHome,
          onSelect: onHome,
        },
        { type: "separator", id: "sep" },
        {
          id: "delete",
          label: "Delete",
          destructive: true,
          disabled: page.isHome,
          hint: page.isHome ? "Set another page as home first" : undefined,
          onSelect: onDelete,
        },
      ]}
    />
  );
}

function PageFormDialog({
  title,
  submitLabel,
  pages,
  published,
  page,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  pages: EditorPage[];
  published: boolean;
  page?: EditorPage;
  onClose: () => void;
  onSubmit: (title: string, slug: string) => Promise<void>;
}) {
  const [name, setName] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(page));
  const [editingSlug, setEditingSlug] = useState(false);
  const slugId = useId();
  const taken = pages.some(
    (item) => item.id !== page?.id && item.slug === slug,
  );
  const valid =
    name.trim().length > 0 &&
    name.trim().length <= 60 &&
    isValidPageSlug(slug) &&
    !taken;
  const showOld =
    published && page && !page.isHome && slug !== page.slug && slug.length > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="secondary" size="desktop" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="desktop"
            disabled={!valid}
            onClick={() => void onSubmit(name.trim(), slug)}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <label className="mt-4 block text-xs leading-4 font-medium text-ink">
        Title
        <Input
          data-autofocus=""
          className="mt-1"
          size="desktop"
          value={name}
          maxLength={60}
          onChange={(event) => {
            const next = event.target.value;
            setName(next);
            if (!slugEdited) setSlug(derivePageSlug(next));
          }}
        />
      </label>
      <div className="mt-3 flex items-center gap-2 text-sm leading-5 text-ink-3">
        <Icon name="document" size={16} />
        {editingSlug ? (
          <Input
            id={slugId}
            aria-label="Address"
            size="desktop"
            value={slug}
            className="h-8 flex-1"
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value.toLowerCase());
            }}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">
            {page?.isHome ? "/" : `/${slug || "…"}`}
          </span>
        )}
        <button
          type="button"
          className="text-sm text-ink"
          onClick={() => setEditingSlug((value) => !value)}
        >
          Edit
        </button>
      </div>
      {taken ? (
        <p className="mt-2 text-xs leading-4 text-error">
          That address is already used on this site.
        </p>
      ) : null}
      {pageSlugError(slug) ? (
        <p className="mt-2 text-xs leading-4 text-error">
          {pageSlugError(slug)}
        </p>
      ) : null}
      {showOld ? (
        <p className="mt-2 text-xs leading-4 text-ink-3">
          Old links to /{page.slug} will stop working.
        </p>
      ) : null}
    </Dialog>
  );
}

function DeletePageDialog({
  page,
  onClose,
  onConfirm,
}: {
  page?: EditorPage;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!page) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Delete ${page.title}?`}
      lead="Its content will be removed from both layouts."
      actions={
        <>
          <Button variant="secondary" size="desktop" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="desktop"
            onClick={() => void onConfirm()}
          >
            Delete
          </Button>
        </>
      }
    />
  );
}
