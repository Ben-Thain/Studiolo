"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { mobileFontSize } from "@/editor/fonts";
import { gridPlacement, GRID_AUTO_ROWS } from "@/editor/renderGrid";
import { GRID_COLUMNS, ROW_UNIT_PX, snapLayout } from "@/editor/grid";
import type { GridBox, SizeStep } from "@/editor/types";
import {
  columnWidthPx,
  DESIGN_WIDTH,
  GRID_GUTTER,
  pixelsToGridDelta,
  STAGE_PADDING_X,
} from "@/lib/editor/stage-coords";
import { ensureFontFace } from "@/lib/editor/load-font";
import { lineHeightForSizeStep } from "@/lib/editor/typography";
import type { EditorDoc, EditorElement, EditorSection } from "@/editor/types";
import { cn } from "@/lib/utils";

const MOBILE_WIDTH = 393;

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

function assetUrl(
  doc: EditorDoc,
  assetId: string | null | undefined,
): string | undefined {
  if (!assetId || !doc.assets?.[assetId]) return undefined;
  return doc.assets[assetId].readUrl;
}

type LayoutName = "desktop" | "mobile";

type DragMode = {
  kind: "move" | "resize";
  elementId: string;
  startBox: GridBox;
  startX: number;
  startY: number;
  pointerId: number;
};

export function EditorStage({
  doc,
  pageId,
  layout,
  navTitles,
  label,
  selectedId,
  editingId,
  focusedId,
  onSelect,
  onFocus,
  onEdit,
  onCommitText,
  onMove,
  onResize,
}: {
  doc: EditorDoc;
  pageId: string;
  layout: LayoutName;
  navTitles: string[];
  label: string;
  selectedId: string | null;
  editingId: string | null;
  focusedId: string | null;
  onSelect: (id: string | null) => void;
  onFocus: (id: string | null) => void;
  onEdit: (id: string | null) => void;
  onCommitText: (elementId: string, text: string) => void;
  onMove: (elementId: string, col: number, row: number) => void;
  onResize: (elementId: string, span: number, rows: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState<DragMode | null>(null);
  const dragRef = useRef<DragMode | null>(null);
  const liveRef = useRef<GridBox | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const workSamples = useRef<number[]>([]);
  const designWidth = layout === "mobile" ? MOBILE_WIDTH : DESIGN_WIDTH;

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node || layout !== "desktop") {
      setScale(1);
      return;
    }
    const measure = () => {
      const w = node.clientWidth;
      setScale(w > 0 ? Math.min(1, w / DESIGN_WIDTH) : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [layout]);

  const colWidth = columnWidthPx(designWidth, GRID_GUTTER, STAGE_PADDING_X);

  const finishDrag = useCallback(() => {
    const box = liveRef.current;
    const mode = dragRef.current;
    dragRef.current = null;
    liveRef.current = null;
    if (overlayRef.current) overlayRef.current.style.transform = "";
    setDrag(null);
    if (!mode || !box) return;
    if (mode.kind === "move") onMove(mode.elementId, box.col, box.row);
    else onResize(mode.elementId, box.span, box.rows);
  }, [onMove, onResize]);

  const scheduleSnap = useCallback(
    (mode: DragMode, dx: number, dy: number) => {
      const others = doc.layouts
        .filter(
          (l) =>
            l.elementId !== mode.elementId &&
            l.breakpoint === layout &&
            !l.hidden,
        )
        .map((l) => ({
          col: l.col,
          span: l.span,
          row: l.row,
          rows: l.rows,
        }));
      let box: GridBox;
      if (mode.kind === "move") {
        const { dCol, dRow } = pixelsToGridDelta(
          dx / scale,
          dy / scale,
          colWidth,
          ROW_UNIT_PX,
        );
        box = {
          ...mode.startBox,
          col: mode.startBox.col + dCol,
          row: mode.startBox.row + dRow,
        };
      } else {
        const widthPx =
          mode.startBox.span * colWidth +
          (mode.startBox.span - 1) * GRID_GUTTER +
          dx / scale;
        const heightPx = mode.startBox.rows * ROW_UNIT_PX + dy / scale;
        const span = Math.max(
          1,
          Math.min(
            GRID_COLUMNS,
            Math.round((widthPx + GRID_GUTTER) / (colWidth + GRID_GUTTER)),
          ),
        );
        const rows = Math.max(1, Math.round(heightPx / ROW_UNIT_PX));
        box = { ...mode.startBox, span, rows };
      }
      const snapped = snapLayout(box, others);
      liveRef.current = snapped.box;
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const frame = frameRef.current;
        const node = frame?.querySelector<HTMLElement>(
          `[data-element-id="${mode.elementId}"]`,
        );
        if (frame && node && overlayRef.current && chipRef.current) {
          const frameRect = frame.getBoundingClientRect();
          const rect = node.getBoundingClientRect();
          const left = (rect.left - frameRect.left) / scale;
          const top = (rect.top - frameRect.top) / scale;
          overlayRef.current.style.left = `${left}px`;
          overlayRef.current.style.top = `${top}px`;
          overlayRef.current.style.width = `${rect.width / scale}px`;
          overlayRef.current.style.height = `${rect.height / scale}px`;
          overlayRef.current.style.transform = `translate(${dx / scale}px, ${dy / scale}px)`;
          chipRef.current.style.left = `${left + rect.width / scale - 28}px`;
          chipRef.current.style.top = `${top - 16}px`;
          chipRef.current.style.transform = `translate(${dx / scale}px, ${dy / scale}px)`;
          chipRef.current.textContent = String(
            mode.kind === "resize" ? snapped.box.span : snapped.readout.y,
          );
        }
        if (guideRef.current) {
          const guide = snapped.guides[0];
          guideRef.current.hidden = !guide;
          if (guide?.axis === "x") {
            guideRef.current.style.left = `${STAGE_PADDING_X + (guide.position - 1) * (colWidth + GRID_GUTTER)}px`;
            guideRef.current.style.top = "0";
            guideRef.current.style.width = "1px";
            guideRef.current.style.height = "100%";
          }
        }
      });
    },
    [colWidth, doc.layouts, layout, scale],
  );

  const beginDrag = useCallback(
    (
      mode: Omit<DragMode, "startX" | "startY" | "pointerId">,
      event: ReactPointerEvent,
    ) => {
      const full: DragMode = {
        ...mode,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
      };
      dragRef.current = full;
      setDrag(full);
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== full.pointerId) return;
        const started = performance.now();
        scheduleSnap(full, ev.clientX - full.startX, ev.clientY - full.startY);
        workSamples.current.push(performance.now() - started);
        const target = window as unknown as { __dragWork?: number[] };
        target.__dragWork = workSamples.current;
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== full.pointerId) return;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        finishDrag();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [finishDrag, scheduleSnap],
  );

  return (
    <div ref={viewportRef} className="flex w-full justify-center">
      <div
        className="relative"
        style={{
          width: designWidth * (layout === "desktop" ? scale : 1),
        }}
      >
        <div
          ref={frameRef}
          role="region"
          aria-label={label}
          data-preview={layout}
          data-editor-canvas=""
          tabIndex={-1}
          className={cn(
            "relative rounded-dialog border border-line bg-bg",
            layout === "mobile" ? "w-[393px]" : "origin-top-left",
          )}
          style={
            layout === "desktop"
              ? {
                  width: DESIGN_WIDTH,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }
              : undefined
          }
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              onSelect(null);
              onFocus(null);
            }
          }}
        >
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
                    scale={layout === "desktop" ? scale : 1}
                    doc={doc}
                    element={element}
                    style={gridPlacement(box)}
                    selected={element.id === selectedId}
                    focused={element.id === focusedId}
                    editing={element.id === editingId}
                    layout={layout}
                    navTitles={navTitles}
                    onSelect={() => {
                      onSelect(element.id);
                      onFocus(element.id);
                    }}
                    onEdit={() => onEdit(element.id)}
                    onCommitText={(text) => onCommitText(element.id, text)}
                    onStartMove={(startBox, event) =>
                      beginDrag(
                        {
                          kind: "move",
                          elementId: element.id,
                          startBox,
                        },
                        event,
                      )
                    }
                    onStartResize={(startBox, event) =>
                      beginDrag(
                        {
                          kind: "resize",
                          elementId: element.id,
                          startBox,
                        },
                        event,
                      )
                    }
                    box={box}
                  />
                );
              })}
            </div>
          ))}
          {drag ? (
            <>
              <div
                ref={guideRef}
                data-drag-guides=""
                hidden
                className="pointer-events-none absolute z-10 bg-ink"
              />
              <div
                ref={overlayRef}
                data-drag-overlay=""
                className="pointer-events-none absolute z-20 border border-ink"
              />
              <div
                ref={chipRef}
                data-drag-readout=""
                className="pointer-events-none absolute z-20 rounded bg-ink px-1.5 py-px text-[11px] text-bg"
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CanvasItem({
  doc,
  element,
  scale,
  style,
  selected,
  focused,
  editing,
  layout,
  navTitles,
  onSelect,
  onEdit,
  onCommitText,
  onStartMove,
  onStartResize,
  box,
}: {
  doc: EditorDoc;
  element: EditorElement;
  scale: number;
  style: CSSProperties;
  selected: boolean;
  focused: boolean;
  editing: boolean;
  layout: LayoutName;
  navTitles: string[];
  onSelect: () => void;
  onEdit: () => void;
  onCommitText: (text: string) => void;
  onStartMove: (box: GridBox, event: ReactPointerEvent) => void;
  onStartResize: (box: GridBox, event: ReactPointerEvent) => void;
  box: GridBox;
}) {
  const moveOrigin = useRef<{
    x: number;
    y: number;
    dragging: boolean;
  } | null>(null);
  const text = String(element.content.text ?? "");
  const size = Number(element.content.fontSize ?? 18);
  const shown = layout === "mobile" ? mobileFontSize(size) : size;
  const lineHeight = lineHeightForSizeStep(size as SizeStep);
  const family = String(element.content.fontFamily ?? "Inter");
  const src = assetUrl(doc, element.content.assetId as string | null);
  useEffect(() => {
    if (element.type === "text") ensureFontFace(family);
  }, [element.type, family]);

  const onPointerDown = (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest("[data-resize-handle]")) return;
    onSelect();
    moveOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (!moveOrigin.current || moveOrigin.current.dragging) return;
    const dx = event.clientX - moveOrigin.current.x;
    const dy = event.clientY - moveOrigin.current.y;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    moveOrigin.current.dragging = true;
    onStartMove(box, event);
  };
  const onPointerUp = () => {
    moveOrigin.current = null;
  };

  return (
    <div
      data-element={element.name}
      data-element-id={element.id}
      data-col={box.col}
      data-span={box.span}
      data-rows={box.rows}
      tabIndex={focused ? 0 : -1}
      className={cn(
        "relative min-w-0 outline-none",
        selected && "outline outline-1 outline-ink",
        focused && "ring-1 ring-brand",
      )}
      style={{ ...style, touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      {selected ? (
        <>
          <span
            data-resize-handle=""
            className="absolute z-30 cursor-nwse-resize bg-ink"
            style={{
              width: 8 / scale,
              height: 8 / scale,
              left: -4 / scale,
              top: -4 / scale,
              padding: 8 / scale,
              margin: -8 / scale,
              backgroundClip: "content-box",
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onStartResize(box, event);
            }}
          />
          <span
            className="absolute z-30 bg-ink"
            style={{
              width: 8 / scale,
              height: 8 / scale,
              right: -4 / scale,
              top: -4 / scale,
              padding: 8 / scale,
              margin: -8 / scale,
              backgroundClip: "content-box",
            }}
          />
          <span
            className="absolute z-30 bg-ink"
            style={{
              width: 8 / scale,
              height: 8 / scale,
              left: -4 / scale,
              bottom: -4 / scale,
              padding: 8 / scale,
              margin: -8 / scale,
              backgroundClip: "content-box",
            }}
          />
          <span
            data-resize-handle=""
            className="absolute z-30 cursor-nwse-resize bg-ink"
            style={{
              width: 8 / scale,
              height: 8 / scale,
              right: -4 / scale,
              bottom: -4 / scale,
              padding: 8 / scale,
              margin: -8 / scale,
              backgroundClip: "content-box",
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onStartResize(box, event);
            }}
          />
        </>
      ) : null}
      {element.type === "text" ? (
        editing ? (
          <textarea
            autoFocus
            defaultValue={text}
            className="w-full bg-transparent text-ink outline-none"
            style={{ fontSize: shown, lineHeight }}
            onBlur={(event) => onCommitText(event.target.value)}
          />
        ) : (
          <p
            className="whitespace-pre-line text-ink"
            style={{
              fontSize: shown,
              lineHeight,
              fontFamily: String(element.content.fontFamily ?? "Inter"),
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
        src ? (
          <img
            src={src}
            alt={String(element.content.alt ?? "")}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full min-h-16 items-center justify-center rounded-control bg-surface-2 text-xs text-ink-2">
            {element.name}
          </div>
        )
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
