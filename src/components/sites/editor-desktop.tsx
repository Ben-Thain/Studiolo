"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  confirmAssetUpload,
  createAssetUpload,
} from "@/app/(app)/sites/[siteId]/actions/assets";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { Toggle } from "@/components/ui/toggle";
import { applyCommand } from "@/editor/commands";
import { mobileFontSize } from "@/editor/fonts";
import { gridPlacement, GRID_AUTO_ROWS } from "@/editor/renderGrid";
import {
  createHistory,
  redo as redoHistory,
  undo as undoHistory,
  type HistoryState,
} from "@/editor/history";
import { FONT_FAMILIES, SIZE_STEPS } from "@/editor/fonts";
import { createEditorPersist } from "@/lib/editor/persist-client";
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
    const handle = createEditorPersist({
      siteId,
      doc: initialDoc,
      onSessionExpired: () => router.push("/login"),
    });
    persistRef.current = handle;
    return handle.status.subscribe(() => {
      setStatus(handle.persister.getState().status);
    });
  }, [initialDoc, router, siteId]);

  const addHost =
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>("[data-editor-add]");
  const statusHost =
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>("[data-editor-status]");
  const layersHost =
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>("[data-layers-slot]");

  useEffect(() => {
    document
      .querySelector("[data-layers-fallback]")
      ?.setAttribute("hidden", "");
  }, []);

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
      try {
        const prepared = await prepareImage(file);
        const ticket = await createAssetUpload(siteId);
        if (!ticket.ok) throw new Error(ticket.error);
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
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (typing) return;
      if (event.key === "Escape") {
        setSelectedId(null);
        setEditingId(null);
        setConfirmDelete(false);
      }
      if (event.key === "t" || event.key === "T") addText();
      if (event.key === "i" || event.key === "I") startImage(false);
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
        <Stage
          doc={doc}
          pageId={pageId}
          layout={layout}
          navTitles={navTitles}
          label={`${page?.title ?? "Page"} page`}
          selectedId={selectedId}
          editingId={editingId}
          onSelect={setSelectedId}
          onEdit={setEditingId}
          onCommitText={(elementId, text) =>
            run({ type: "updateContent", elementId, content: { text } })
          }
          onMove={(elementId, col, row) =>
            run({ type: "move", elementId, breakpoint: layout, col, row })
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
          <p className="mt-3 text-xs text-ink-3">Uploading…</p>
        ) : null}
      </div>
      <Inspector
        doc={doc}
        pageTitle={page?.title ?? "Page"}
        layout={layout}
        element={selected}
        sectionName={selectedSection?.name ?? ""}
        siteId={siteId}
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

function Stage({
  doc,
  pageId,
  layout,
  navTitles,
  label,
  selectedId,
  editingId,
  onSelect,
  onEdit,
  onCommitText,
  onMove,
}: {
  doc: EditorDoc;
  pageId: string;
  layout: LayoutName;
  navTitles: string[];
  label: string;
  selectedId: string | null;
  editingId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (id: string | null) => void;
  onCommitText: (id: string, text: string) => void;
  onMove: (id: string, col: number, row: number) => void;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      className={cn(
        "relative mx-auto rounded-dialog border border-line bg-bg",
        layout === "mobile" ? "w-[393px]" : "w-full max-w-[960px]",
      )}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onSelect(null);
      }}
    >
      <div data-preview={layout}>
        {sectionsForPage(doc, pageId).map((section) => (
          <div
            key={section.id}
            data-section={section.name}
            className="grid grid-cols-12 gap-x-6 px-8 py-4"
            style={{ gridAutoRows: GRID_AUTO_ROWS }}
          >
            {elementsIn(doc, section.id).map((element) => {
              const box = doc.layouts.find(
                (item) =>
                  item.elementId === element.id && item.breakpoint === layout,
              );
              if (!box || box.hidden) return null;
              return (
                <CanvasItem
                  key={element.id}
                  element={element}
                  style={gridPlacement(box)}
                  selected={element.id === selectedId}
                  editing={element.id === editingId}
                  layout={layout}
                  navTitles={navTitles}
                  onSelect={() => onSelect(element.id)}
                  onEdit={() => onEdit(element.id)}
                  onCommitText={(text) => onCommitText(element.id, text)}
                  onMove={(col, row) => onMove(element.id, col, row)}
                  origin={{ col: box.col, row: box.row }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CanvasItem({
  element,
  style,
  selected,
  editing,
  layout,
  navTitles,
  onSelect,
  onEdit,
  onCommitText,
  onMove,
  origin,
}: {
  element: EditorElement;
  style: CSSProperties;
  selected: boolean;
  editing: boolean;
  layout: LayoutName;
  navTitles: string[];
  onSelect: () => void;
  onEdit: () => void;
  onCommitText: (text: string) => void;
  onMove: (col: number, row: number) => void;
  origin: { col: number; row: number };
}) {
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent) => {
    onSelect();
    drag.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current = null;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    const col = origin.col + Math.round(dx / (1440 / 12));
    const row = origin.row + Math.round(dy / 8);
    onMove(Math.min(12, Math.max(1, col)), Math.max(1, row));
  };
  const text = String(element.content.text ?? "");
  const size = Number(element.content.fontSize ?? 18);
  const shown = layout === "mobile" ? mobileFontSize(size) : size;
  return (
    <div
      data-element={element.name}
      className={cn(
        "relative min-w-0",
        selected && "outline outline-1 outline-ink",
      )}
      style={{ ...style, touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onDoubleClick={onEdit}
    >
      {selected ? (
        <>
          <span className="absolute -top-1 -left-1 size-2 bg-ink" />
          <span className="absolute -top-1 -right-1 size-2 bg-ink" />
          <span className="absolute -bottom-1 -left-1 size-2 bg-ink" />
          <span className="absolute -right-1 -bottom-1 size-2 bg-ink" />
        </>
      ) : null}
      {element.type === "text" ? (
        editing ? (
          <textarea
            autoFocus
            defaultValue={text}
            className="w-full bg-transparent text-ink outline-none"
            style={{ fontSize: shown }}
            onBlur={(event) => onCommitText(event.target.value)}
          />
        ) : (
          <p
            className="whitespace-pre-line text-ink"
            style={{
              fontSize: shown,
              fontWeight:
                Number(element.content.fontWeight) === 500 ? 500 : 400,
              textAlign:
                (element.content.align as CSSProperties["textAlign"]) ?? "left",
            }}
          >
            {text}
          </p>
        )
      ) : null}
      {element.type === "image" ? (
        <div className="flex h-full min-h-16 items-center justify-center rounded-control bg-surface-2 text-xs text-ink-2">
          {element.name}
        </div>
      ) : null}
      {element.type === "nav" ? (
        <ul className="flex flex-wrap justify-end gap-x-6 text-sm text-ink-2">
          {navTitles.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
      ) : null}
      {element.type === "form" ? (
        <p className="text-sm text-ink">
          {String(element.content.buttonLabel ?? "Send")}
        </p>
      ) : null}
    </div>
  );
}

function Inspector({
  doc,
  pageTitle,
  layout,
  element,
  sectionName,
  siteId,
  onRun,
  onReplace,
  onDelete,
}: {
  doc: EditorDoc;
  pageTitle: string;
  layout: LayoutName;
  element: EditorElement | null;
  sectionName: string;
  siteId: string;
  onRun: (command: EditorCommand) => void;
  onReplace: () => void;
  onDelete: () => void;
}) {
  const layoutName = layout === "mobile" ? "Mobile" : "Desktop";
  const box = element
    ? doc.layouts.find(
        (item) => item.elementId === element.id && item.breakpoint === layout,
      )
    : null;
  return (
    <aside className="hidden w-[288px] shrink-0 border-l border-line bg-bg px-4 py-5 min-[900px]:block">
      {!element ? (
        <>
          <h2 className="text-sm font-medium text-ink">{pageTitle}</h2>
          <p className="mt-1 text-xs text-ink-3">Page · {layoutName} layout</p>
          <p className="mt-4 text-sm leading-5 text-ink-2">
            Select something on the page to edit it. Press T for a text box or I
            for an image.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-sm font-medium text-ink">{element.name}</h2>
          <p className="mt-1 text-xs text-ink-3">
            {element.type === "image" ? "Image" : "Text box"} · {sectionName}{" "}
            section
          </p>
          {element.type === "image" ? (
            <div className="mt-4">
              <div className="mb-3 flex h-24 items-center justify-center rounded-control bg-surface-2 text-xs text-ink-2">
                {element.name}
              </div>
              <Button variant="secondary" size="sm" onClick={onReplace}>
                Replace image
              </Button>
              <label className="mt-4 block text-xs text-ink-3">
                Alt text
                <textarea
                  className="mt-1 w-full rounded-control border border-line p-2 text-sm text-ink"
                  value={String(element.content.alt ?? "")}
                  placeholder="Describe the image for screen readers"
                  onChange={(event) =>
                    onRun({
                      type: "updateContent",
                      elementId: element.id,
                      content: { alt: event.target.value },
                    })
                  }
                />
              </label>
            </div>
          ) : null}
          {element.type === "text" ? (
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-xs text-ink-3">
                Font
                <select
                  className="mt-1 h-8 w-full rounded-control border border-line px-2 text-sm"
                  value={String(element.content.fontFamily ?? "Inter")}
                  onChange={(event) =>
                    onRun({
                      type: "updateContent",
                      elementId: element.id,
                      content: { fontFamily: event.target.value },
                    })
                  }
                >
                  {FONT_FAMILIES.map((family) => (
                    <option key={family}>{family}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-ink-3">
                Size
                <select
                  className="mt-1 h-8 w-full rounded-control border border-line px-2 text-sm"
                  value={String(element.content.fontSize ?? 18)}
                  onChange={(event) =>
                    onRun({
                      type: "updateContent",
                      elementId: element.id,
                      content: { fontSize: Number(event.target.value) },
                    })
                  }
                >
                  {SIZE_STEPS.map((step) => (
                    <option key={step} value={step}>
                      {step}
                    </option>
                  ))}
                </select>
              </label>
              <Segmented
                label="Align"
                value={String(element.content.align ?? "left")}
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Centre" },
                  { value: "right", label: "Right" },
                ]}
                onChange={(value) =>
                  onRun({
                    type: "updateContent",
                    elementId: element.id,
                    content: { align: value },
                  })
                }
              />
            </div>
          ) : null}
          {element.type === "nav" ? (
            <p className="mt-4 text-sm text-ink-2">
              Shows pages that are in the menu.{" "}
              <a className="underline" href={`/sites/${siteId}/pages`}>
                Change them in Pages.
              </a>
            </p>
          ) : null}
          {element.type === "form" ? (
            <>
              <label className="mt-4 block text-xs text-ink-3">
                Button label
                <input
                  className="mt-1 h-8 w-full rounded-control border border-line px-2 text-sm"
                  value={String(element.content.buttonLabel ?? "")}
                  onChange={(event) =>
                    onRun({
                      type: "updateContent",
                      elementId: element.id,
                      content: { buttonLabel: event.target.value },
                    })
                  }
                />
              </label>
              <p className="mt-3 text-sm text-ink-2">
                Submissions arrive in Submissions.
              </p>
            </>
          ) : null}
          {element.type === "text" || element.type === "image" ? (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink">Hide on {layout}</span>
                <Toggle
                  label={`Hide on ${layout}`}
                  checked={box?.hidden ?? false}
                  onChange={(hidden) =>
                    onRun({
                      type: "setHidden",
                      elementId: element.id,
                      breakpoint: layout,
                      hidden,
                    })
                  }
                />
              </div>
              <p className="mt-2 text-xs text-ink-3">
                Position and size are per layout. The image is shared.
              </p>
              <button
                type="button"
                className="mt-6 text-sm text-error"
                onClick={onDelete}
              >
                Delete from both layouts
              </button>
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
}
