"use client";

import {
  useCallback,
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
  const [liveBox, setLiveBox] = useState<GridBox | null>(null);
  const [readout, setReadout] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ axis: "x" | "y"; at: number }[]>([]);
  const raf = useRef<number | null>(null);
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
    if (!drag || !liveBox) {
      setDrag(null);
      setLiveBox(null);
      setGuides([]);
      setReadout(null);
      return;
    }
    if (drag.kind === "move") {
      onMove(drag.elementId, liveBox.col, liveBox.row);
    } else {
      onResize(drag.elementId, liveBox.span, liveBox.rows);
    }
    setDrag(null);
    setLiveBox(null);
    setGuides([]);
    setReadout(null);
  }, [drag, liveBox, onMove, onResize]);

  const scheduleSnap = useCallback(
    (mode: DragMode, dx: number, dy: number) => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
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
        setLiveBox(snapped.box);
        setGuides(
          snapped.guides.map((g) => ({
            axis: g.axis,
            at: g.position,
          })),
        );
        setReadout(`${snapped.readout.x}, ${snapped.readout.y}`);
      });
    },
    [colWidth, doc.layouts, layout, scale],
  );

  const beginDrag = useCallback(
    (
      mode: Omit<DragMode, "startX" | "startY" | "pointerId">,
      event: ReactPointerEvent,
    ) => {
      setDrag({
        ...mode,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
      });
      try {
        frameRef.current?.setPointerCapture(event.pointerId);
      } catch {
        /* synthetic pointer events in tests may not support capture */
      }
    },
    [],
  );

  const onGlobalPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      scheduleSnap(
        drag,
        event.clientX - drag.startX,
        event.clientY - drag.startY,
      );
    },
    [drag, scheduleSnap],
  );

  return (
    <div
      ref={viewportRef}
      className="flex w-full justify-center"
      onPointerMove={drag ? onGlobalPointerMove : undefined}
      onPointerUp={
        drag
          ? (event) => {
              if (event.pointerId === drag.pointerId) finishDrag();
            }
          : undefined
      }
      onPointerCancel={
        drag
          ? (event) => {
              if (event.pointerId === drag.pointerId) finishDrag();
            }
          : undefined
      }
    >
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
                const displayBox =
                  drag && drag.elementId === element.id && liveBox
                    ? liveBox
                    : box;
                return (
                  <CanvasItem
                    key={element.id}
                    doc={doc}
                    element={element}
                    style={gridPlacement(displayBox)}
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
                    box={displayBox}
                  />
                );
              })}
            </div>
          ))}
          {drag && liveBox ? (
            <div
              data-drag-guides=""
              className="pointer-events-none absolute inset-0 z-10"
              aria-hidden
            >
              {guides.map((guide, index) => (
                <DragGuide key={index} guide={guide} layout={layout} />
              ))}
              {readout ? (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded bg-ink px-2 py-0.5 text-xs text-bg">
                  {readout}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DragGuide({
  guide,
  layout,
}: {
  guide: { axis: "x" | "y"; at: number };
  layout: LayoutName;
}) {
  const colWidth = columnWidthPx(
    layout === "mobile" ? MOBILE_WIDTH : DESIGN_WIDTH,
  );
  if (guide.axis === "x") {
    const left =
      STAGE_PADDING_X +
      (guide.at - 1) * (colWidth + GRID_GUTTER) +
      colWidth / 2;
    return (
      <div className="absolute top-0 bottom-0 w-px bg-ink" style={{ left }} />
    );
  }
  const top = (guide.at - 1) * ROW_UNIT_PX;
  return (
    <div className="absolute right-0 left-0 h-px bg-ink" style={{ top }} />
  );
}

function CanvasItem({
  doc,
  element,
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
  const src = assetUrl(doc, element.content.assetId as string | null);

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
            className="absolute -top-1 -left-1 size-2 cursor-nwse-resize rounded-full border border-bg bg-ink"
            onPointerDown={(event) => {
              event.stopPropagation();
              onStartResize(box, event);
            }}
          />
          <span className="absolute -top-1 -right-1 size-2 rounded-full bg-ink" />
          <span className="absolute -bottom-1 -left-1 size-2 rounded-full bg-ink" />
          <span
            data-resize-handle=""
            className="absolute -right-1 -bottom-1 size-2 cursor-nwse-resize rounded-full border border-bg bg-ink"
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
