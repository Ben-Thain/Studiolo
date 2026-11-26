"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  cancelAssetUpload,
  confirmAssetUpload,
  createAssetUpload,
  refreshAssetReadUrls,
} from "@/app/(app)/sites/[siteId]/actions/assets";
import { readUrlRefreshDelayMs } from "@/lib/assets/read-url-refresh";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { applyCommand } from "@/editor/commands";
import { hydrateDraft } from "@/editor/persist";
import { authHref } from "@/lib/auth/next";
import { EditorInspector } from "./editor-inspector";
import { EditorStage } from "./editor-stage";
import {
  createHistory,
  redo as redoHistory,
  undo as undoHistory,
  type HistoryState,
} from "@/editor/history";
import {
  createEditorPersist,
  restoreCrashDraft,
} from "@/lib/editor/persist-client";
import { useEditorShellSlots } from "./editor-shell-slots";
import { prepareImage } from "@/lib/images/prepare";
import { cn } from "@/lib/utils";
import type { EditorCommand } from "@/editor/command-types";
import type {
  EditorDoc,
  EditorElement,
  EditorSection,
  SaveStatus,
} from "@/editor/types";

type LayoutName = "desktop" | "mobile";

function uploadWithProgress(
  url: string,
  blob: Blob,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", blob.type || "image/webp");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Could not upload the photo."));
    };
    xhr.onerror = () => reject(new Error("Could not upload the photo."));
    xhr.send(blob);
  });
}

function statusCopy(status: SaveStatus): string {
  if (status === "saving") return "Saving…";
  if (status === "offline") return "Offline — changes kept on this device";
  if (status === "error") return "Couldn't save";
  return "Saved";
}

function sectionsForPage(doc: EditorDoc, pageId: string): EditorSection[] {
  return doc.sections
    .filter((section) => section.pageId === null || section.pageId === pageId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function elementsIn(doc: EditorDoc, sectionId: string): EditorElement[] {
  return doc.elements
    .filter((element) => element.sectionId === sectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function EditorDesktop({
  siteId,
  pageId,
  initialDoc,
  initialLayout = "desktop",
  fromTemplate,
  siteName,
}: {
  siteId: string;
  pageId: string;
  initialDoc: EditorDoc;
  initialLayout?: LayoutName;
  fromTemplate?: string;
  siteName?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const toasted = useRef(false);
  const [doc, setDoc] = useState(initialDoc);
  const historyRef = useRef<HistoryState>(createHistory());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutName>(initialLayout);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reAuthOpen, setReAuthOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addTriggerRef = useRef<HTMLDivElement>(null);
  const replaceRef = useRef(false);
  const persistRef = useRef<ReturnType<typeof createEditorPersist> | null>(
    null,
  );
  const docRef = useRef(doc);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  useEffect(() => {
    let active = true;
    const handle = createEditorPersist({
      siteId,
      doc: initialDoc,
      onSessionExpired: () => setReAuthOpen(true),
    });
    persistRef.current = handle;
    const unsub = handle.status.subscribe(() => {
      setStatus(handle.persister.getState().status);
    });
    void restoreCrashDraft(siteId)
      .then(() => hydrateDraft(handle.persister, initialDoc))
      .then((next) => {
        if (!active) return;
        docRef.current = next;
        setDoc(next);
      });
    return () => {
      active = false;
      unsub();
      handle.dispose();
    };
  }, [initialDoc, siteId]);

  useEffect(() => {
    if (!fromTemplate || toasted.current) return;
    toasted.current = true;
    toast({
      message: `${siteName ?? "Your site"} is ready. Replace the sample photos and words with your own.`,
      action: { label: "Got it", onClick: () => undefined },
      duration: 10_000,
      region: "site",
    });
    const url = new URL(window.location.href);
    url.searchParams.delete("from");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [fromTemplate, router, siteName, toast]);

  const { addHost, statusHost, layersHost } = useEditorShellSlots();

  useEffect(() => {
    if (!layersHost) return;
    document
      .querySelector("[data-layers-fallback]")
      ?.setAttribute("hidden", "");
  }, [layersHost]);

  const run = useCallback((command: EditorCommand) => {
    const result = applyCommand(docRef.current, command);
    docRef.current = result.doc;
    setDoc(result.doc);
    const current = historyRef.current;
    historyRef.current = {
      past: [...current.past, { inverse: result.inverse }].slice(-50),
      future: [],
    };
    persistRef.current?.queue(result.changes);
  }, []);

  const undo = useCallback(() => {
    const current = historyRef.current;
    const inverse = current.past.at(-1)?.inverse;
    const result = undoHistory(docRef.current, current);
    if (!result) return;
    historyRef.current = result.history;
    docRef.current = result.doc;
    setDoc(result.doc);
    if (inverse) persistRef.current?.queue(inverse);
  }, []);

  const redo = useCallback(() => {
    const current = historyRef.current;
    const forward = current.future[0];
    const result = redoHistory(docRef.current, current);
    if (!result || !forward) return;
    historyRef.current = result.history;
    docRef.current = result.doc;
    setDoc(result.doc);
    persistRef.current?.queue(forward);
  }, []);

  const targetSection = useCallback(() => {
    const sections = sectionsForPage(docRef.current, pageId);
    return sections.find((section) => section.pageId === pageId) ?? sections[0];
  }, [pageId]);

  const addText = useCallback(() => {
    const section = targetSection();
    if (!section) return;
    const before = docRef.current.elements.length;
    run({
      type: "addElement",
      sectionId: section.id,
      elementType: "text",
      name: "Text",
      pageId,
    });
    const newest = docRef.current.elements.at(-1);
    if (newest && docRef.current.elements.length > before) {
      setSelectedId(newest.id);
      setEditingId(newest.id);
    }
  }, [pageId, run, targetSection]);

  const startImage = useCallback((replace: boolean) => {
    replaceRef.current = replace;
    setUploadError(null);
    fileRef.current?.click();
  }, []);

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setUploading(true);
      setUploadError(null);
      let pendingAssetId: string | undefined;
      try {
        const prepared = await prepareImage(file);
        setUploadPreview(URL.createObjectURL(prepared.blob));
        const ticket = await createAssetUpload(siteId);
        if (!ticket.ok) throw new Error(ticket.error);
        pendingAssetId = ticket.assetId;
        await uploadWithProgress(ticket.signedUrl, prepared.blob, (pct) =>
          setUploadProgress(pct),
        );
        const confirmed = await confirmAssetUpload({
          siteId,
          assetId: ticket.assetId,
          bytes: prepared.bytes,
        });
        if (!confirmed.ok) throw new Error(confirmed.error);
        pendingAssetId = undefined;
        const withAsset = {
          ...docRef.current,
          assets: {
            ...(docRef.current.assets ?? {}),
            [ticket.assetId]: {
              path: confirmed.path,
              mime: "image/webp" as const,
              readUrl: confirmed.readUrl,
              readUrlExpiresAt: confirmed.readUrlExpiresAt,
            },
          },
        };
        docRef.current = withAsset;
        setDoc(withAsset);
        if (replaceRef.current && selectedId) {
          run({
            type: "updateContent",
            elementId: selectedId,
            content: { assetId: ticket.assetId },
          });
        } else {
          const section = targetSection();
          if (!section) return;
          const count = docRef.current.elements.length;
          run({
            type: "addElement",
            sectionId: section.id,
            elementType: "image",
            name: "Image",
            pageId,
            content: { assetId: ticket.assetId, alt: "", aspectLocked: true },
          });
          if (docRef.current.elements.length > count) {
            setSelectedId(docRef.current.elements.at(-1)?.id ?? null);
          }
        }
      } catch (error) {
        if (pendingAssetId) {
          await cancelAssetUpload(siteId, pendingAssetId).catch(
            () => undefined,
          );
        }
        setUploadError(
          error instanceof Error
            ? error.message
            : "Could not upload the photo.",
        );
      } finally {
        setUploading(false);
        setUploadPreview((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [pageId, run, selectedId, siteId, targetSection],
  );

  useEffect(() => {
    const expiries = Object.values(doc.assets ?? {})
      .map((asset) => asset.readUrlExpiresAt)
      .filter((value): value is number => typeof value === "number");
    if (!expiries.length) return;
    const delay = readUrlRefreshDelayMs(Math.min(...expiries), Date.now());
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void refreshAssetReadUrls(siteId).then((next) => {
        if (cancelled || !next.ok) return;
        const assets = { ...docRef.current.assets };
        for (const [id, signed] of Object.entries(next.assets)) {
          const current = assets[id];
          if (!current) continue;
          assets[id] = { ...current, ...signed };
        }
        const withUrls = { ...docRef.current, assets };
        docRef.current = withUrls;
        setDoc(withUrls);
      });
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [doc.assets, siteId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const onCanvas =
        !target?.closest("[data-editor-add]") &&
        !target?.closest("[data-editor-status]") &&
        !target?.closest("button") &&
        (target?.closest("[data-editor-canvas]") || target === document.body);
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (inField) return;
      if (event.key === "Escape") {
        setSelectedId(null);
        setEditingId(null);
        setConfirmDelete(false);
      }
      if ((event.key === "t" || event.key === "T") && onCanvas) addText();
      if ((event.key === "i" || event.key === "I") && onCanvas)
        startImage(false);
      if (event.key === "F2" && selectedId) {
        event.preventDefault();
        setRenameId(selectedId);
      }
      if (!selectedId) return;
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        setConfirmDelete(true);
      }
      if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        run({ type: "duplicateElement", elementId: selectedId });
      }
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, event.altKey ? 0 : event.shiftKey ? -4 : -1],
        ArrowDown: [0, event.altKey ? 0 : event.shiftKey ? 4 : 1],
      };
      const delta = deltas[event.key];
      if (!delta) return;
      if (
        event.altKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        const element = docRef.current.elements.find(
          (item) => item.id === selectedId,
        );
        if (!element) return;
        const siblings = elementsIn(docRef.current, element.sectionId);
        const index = siblings.findIndex((item) => item.id === selectedId);
        const next = index + (event.key === "ArrowUp" ? -1 : 1);
        const swap = siblings[next];
        if (!swap) return;
        event.preventDefault();
        run({
          type: "reorderElement",
          elementId: selectedId,
          sortOrder: swap.sortOrder,
        });
        return;
      }
      const box = docRef.current.layouts.find(
        (item) => item.elementId === selectedId && item.breakpoint === layout,
      );
      if (!box) return;
      event.preventDefault();
      run({
        type: "move",
        elementId: selectedId,
        breakpoint: layout,
        col: Math.min(12, Math.max(1, box.col + delta[0])),
        row: Math.max(1, box.row + delta[1]),
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addText, layout, redo, run, selectedId, startImage, undo]);

  const page = doc.pages.find((item) => item.id === pageId);
  const selected = doc.elements.find((item) => item.id === selectedId) ?? null;
  const selectedSection = doc.sections.find(
    (section) => section.id === selected?.sectionId,
  );
  const navTitles = doc.pages
    .filter((item) => item.inNav)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => item.title);

  const switchLayout = (next: string) => {
    const value: LayoutName = next === "mobile" ? "mobile" : "desktop";
    setLayout(value);
    const url = new URL(window.location.href);
    url.searchParams.set("layout", value);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const addMenu = (
    <Menu
      align="start"
      panelClassName="w-[248px]"
      boxedKbd
      trigger={
        <Button
          variant="secondary"
          size="sm"
          icon={<Icon name="plus" size={14} />}
        >
          Add
        </Button>
      }
      items={[
        {
          id: "text",
          label: "Text box",
          kbd: "T",
          icon: <Icon name="document" size={16} />,
          onSelect: addText,
        },
        {
          id: "image",
          label: "Image",
          kbd: "I",
          icon: <Icon name="image" size={16} />,
          onSelect: () => startImage(false),
        },
        { type: "separator", id: "sep" },
        {
          id: "note",
          label: "Adds to both layouts",
          disabled: true,
        },
      ]}
    />
  );

  const layers = (
    <div>
      <div className="flex h-8 items-center gap-2 px-2 text-xs leading-4 text-ink-3">
        <span className="font-medium">Layers</span>
        <span className="min-w-0 flex-1 truncate">{page?.title}</span>
        <button
          type="button"
          aria-label="Add"
          className="grid size-6 place-items-center rounded-control text-ink-2 hover:bg-fill-hover"
          onClick={() =>
            addTriggerRef.current?.querySelector("button")?.click()
          }
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <ul aria-label="Layers" className="pb-2">
        {sectionsForPage(doc, pageId).map((section) => (
          <li key={section.id}>
            <div
              className="flex h-8 cursor-grab items-center px-2 text-sm font-medium text-ink"
              onPointerDown={(event) => {
                const startY = event.clientY;
                const startOrder = section.sortOrder;
                const move = (ev: PointerEvent) => {
                  if (Math.abs(ev.clientY - startY) < 12) return;
                  const sections = sectionsForPage(docRef.current, pageId);
                  const index = sections.findIndex(
                    (item) => item.id === section.id,
                  );
                  const next = ev.clientY > startY ? index + 1 : index - 1;
                  const swap = sections[next];
                  if (!swap || swap.sortOrder === startOrder) return;
                  run({
                    type: "reorderSection",
                    sectionId: section.id,
                    sortOrder: swap.sortOrder,
                  });
                  window.removeEventListener("pointermove", move);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener(
                  "pointerup",
                  () => window.removeEventListener("pointermove", move),
                  { once: true },
                );
              }}
            >
              <Icon name="chevron-down" size={16} className="mr-1 text-ink-2" />
              {section.name}
            </div>
            <ul>
              {elementsIn(doc, section.id).map((element) => (
                <li key={element.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded-control py-0 pr-2 pl-6 text-left text-sm text-ink",
                      element.id === selectedId && "bg-fill-selected",
                    )}
                    onClick={() => setSelectedId(element.id)}
                    onDoubleClick={() => setRenameId(element.id)}
                  >
                    <Icon
                      name={element.type === "image" ? "image" : "text"}
                      size={16}
                      className="text-ink-2"
                    />
                    {renameId === element.id ? (
                      <input
                        autoFocus
                        aria-label={`Rename ${element.name}`}
                        defaultValue={element.name}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            run({
                              type: "renameLayer",
                              elementId: element.id,
                              name: event.currentTarget.value,
                            });
                            setRenameId(null);
                          }
                          if (event.key === "Escape") setRenameId(null);
                        }}
                        onBlur={() => setRenameId(null)}
                      />
                    ) : (
                      <span className="truncate">{element.name}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-1">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        aria-label="Image file"
        className="sr-only"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <div className="min-w-0 flex-1 px-6 pt-4 pb-6">
        <div className="mb-4 flex h-8 w-fit items-center rounded-control border border-line bg-bg mx-auto">
          <Menu
            align="start"
            trigger={
              <button
                type="button"
                className="flex h-8 items-center gap-2 px-3 text-sm text-ink"
              >
                {page?.title}
                <Icon name="chevron-down" size={12} />
              </button>
            }
            items={doc.pages
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((item) => ({
                id: item.id,
                label: item.title,
                icon:
                  item.id === pageId ? (
                    <Icon name="check" size={14} />
                  ) : undefined,
                onSelect: () => {
                  router.push(
                    `/sites/${siteId}/editor/${item.id}?layout=${layout}`,
                  );
                },
              }))}
          />
          <span className="h-4 w-px bg-line" />
          <div className="px-1">
            <Segmented
              bare
              compact
              label="Layout"
              value={layout}
              options={[
                { value: "desktop", label: "Desktop" },
                { value: "mobile", label: "Mobile" },
              ]}
              onChange={switchLayout}
            />
          </div>
        </div>
        <EditorStage
          doc={doc}
          pageId={pageId}
          layout={layout}
          navTitles={navTitles}
          label={`${page?.title ?? "Page"} page`}
          selectedId={selectedId}
          editingId={editingId}
          focusedId={focusedId}
          onSelect={setSelectedId}
          onFocus={setFocusedId}
          onEdit={setEditingId}
          onCommitText={(elementId, text) => {
            const current = docRef.current.elements.find(
              (item) => item.id === elementId,
            );
            if (String(current?.content.text ?? "") === text) return;
            run({ type: "updateContent", elementId, content: { text } });
          }}
          onMove={(elementId, col, row) =>
            run({ type: "move", elementId, breakpoint: layout, col, row })
          }
          onReplace={() => startImage(true)}
          onResize={(elementId, box) =>
            run({
              type: "resize",
              elementId,
              breakpoint: layout,
              col: box.col,
              row: box.row,
              span: box.span,
              rows: box.rows,
            })
          }
        />
        {uploadError ? (
          <p className="mt-3 text-sm text-error">
            {uploadError}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => startImage(replaceRef.current)}
            >
              Try again
            </button>
          </p>
        ) : null}
        {uploading ? (
          <div className="mt-3 flex w-48 items-center gap-2">
            {uploadPreview ? (
              // Local preview of the file being uploaded; not a content image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={uploadPreview}
                alt=""
                className="h-10 w-10 rounded-control object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-3">Uploading…</p>
              <div
                className="mt-1 h-1 overflow-hidden rounded bg-surface-2"
                role="progressbar"
                aria-valuenow={uploadProgress}
              >
                <div
                  className="h-full bg-ink transition-[width]"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <EditorInspector
        doc={doc}
        pageTitle={page?.title ?? "Page"}
        layout={layout}
        element={selected}
        sectionName={selectedSection?.name ?? ""}
        onRun={run}
        onReplace={() => startImage(true)}
        onDelete={() => setConfirmDelete(true)}
      />
      {addHost
        ? createPortal(<div ref={addTriggerRef}>{addMenu}</div>, addHost)
        : null}
      {statusHost
        ? createPortal(
            <>
              <span className="text-xs leading-4 text-ink-3">
                {statusCopy(status)}
              </span>
              {status === "error" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void persistRef.current?.flush()}
                >
                  Retry
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                href={`/sites/${siteId}/preview/${pageId}?layout=${layout}`}
              >
                Preview
              </Button>
            </>,
            statusHost,
          )
        : null}
      {layersHost ? createPortal(layers, layersHost) : null}
      <Dialog
        open={reAuthOpen}
        onClose={() => undefined}
        title="Sign in to keep editing"
        lead="Your session ended. Sign in again to save your changes."
        actions={
          <Button
            href={authHref("/login", `/sites/${siteId}/editor/${pageId}`)}
          >
            Sign in
          </Button>
        }
      />
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this item?"
        lead="It will be removed from the desktop and mobile layouts."
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedId)
                  run({ type: "deleteElement", elementId: selectedId });
                setSelectedId(null);
                setConfirmDelete(false);
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
