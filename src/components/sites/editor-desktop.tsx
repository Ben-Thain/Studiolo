"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  cancelAssetUpload,
  confirmAssetUpload,
  createAssetUpload,
} from "@/app/(app)/sites/[siteId]/actions/assets";
import { Button } from "@/components/ui/button";
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
import { createEditorPersist } from "@/lib/editor/persist-client";
import { useEditorShellSlots } from "./editor-shell-slots";
import { prepareImage } from "@/lib/images/prepare";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { EditorCommand } from "@/editor/command-types";
import type {
  EditorDoc,
  EditorElement,
  EditorSection,
  SaveStatus,
} from "@/editor/types";

type LayoutName = "desktop" | "mobile";

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
}: {
  siteId: string;
  pageId: string;
  initialDoc: EditorDoc;
  initialLayout?: LayoutName;
}) {
  const router = useRouter();
  const [doc, setDoc] = useState(initialDoc);
  const [history, setHistory] = useState<HistoryState>(createHistory);
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
  const fileRef = useRef<HTMLInputElement>(null);
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
    void hydrateDraft(handle.persister, initialDoc).then((next) => {
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
    setHistory((current) => ({
      past: [...current.past, { inverse: result.inverse }].slice(-50),
      future: [],
    }));
    persistRef.current?.queue(result.changes);
  }, []);

  const undo = useCallback(() => {
    const inverse = history.past.at(-1)?.inverse;
    const result = undoHistory(docRef.current, history);
    if (!result) return;
    docRef.current = result.doc;
    setDoc(result.doc);
    setHistory(result.history);
    if (inverse) persistRef.current?.queue(inverse);
  }, [history]);

  const redo = useCallback(() => {
    const forward = history.future[0];
    const result = redoHistory(docRef.current, history);
    if (!result || !forward) return;
    docRef.current = result.doc;
    setDoc(result.doc);
    setHistory(result.history);
    persistRef.current?.queue(forward);
  }, [history]);

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
        const ticket = await createAssetUpload(siteId);
        if (!ticket.ok) throw new Error(ticket.error);
        pendingAssetId = ticket.assetId;
        const supabase = createClient();
        const uploaded = await supabase.storage
          .from("site-assets")
          .uploadToSignedUrl(ticket.path, ticket.token, prepared.blob);
        if (uploaded.error) throw new Error("Could not upload the photo.");
        const confirmed = await confirmAssetUpload({
          siteId,
          assetId: ticket.assetId,
          width: prepared.width,
          height: prepared.height,
          bytes: prepared.bytes,
        });
        if (!confirmed.ok) throw new Error(confirmed.error);
        pendingAssetId = undefined;
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
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [pageId, run, selectedId, siteId, targetSection],
  );

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
          onClick={addText}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <ul aria-label="Layers" className="pb-2">
        {sectionsForPage(doc, pageId).map((section) => (
          <li key={section.id}>
            <div className="flex h-8 items-center px-2 text-sm font-medium text-ink">
              <Icon name="chevron-down" size={12} className="mr-1 text-ink-2" />
              {section.name}
            </div>
            <ul>
              {elementsIn(doc, section.id).map((element) => (
                <li key={element.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded-control px-2 text-left text-sm text-ink",
                      element.id === selectedId && "bg-fill-selected",
                    )}
                    onClick={() => setSelectedId(element.id)}
                    onDoubleClick={() => {
                      const name = window.prompt("Rename", element.name);
                      if (name) {
                        run({
                          type: "renameLayer",
                          elementId: element.id,
                          name,
                        });
                      }
                    }}
                  >
                    <Icon
                      name={element.type === "image" ? "image" : "document"}
                      size={16}
                      className="text-ink-2"
                    />
                    <span className="truncate">{element.name}</span>
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
        <div className="mb-4 flex h-8 w-fit items-center rounded-control border border-line bg-bg">
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
          onCommitText={(elementId, text) =>
            run({ type: "updateContent", elementId, content: { text } })
          }
          onMove={(elementId, col, row) =>
            run({ type: "move", elementId, breakpoint: layout, col, row })
          }
          onResize={(elementId, span, rows) =>
            run({ type: "resize", elementId, breakpoint: layout, span, rows })
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
          <div className="mt-3 w-48">
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
      {addHost ? createPortal(addMenu, addHost) : null}
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
