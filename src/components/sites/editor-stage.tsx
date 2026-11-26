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
import {
  elementSnapTargets,
  sectionSnapTargets,
  snapPxBox,
  commitBox,
  type DragGuide,
  type PxBox,
} from "@/editor/drag";
import { GRID_COLUMNS, ROW_UNIT_PX } from "@/editor/grid";
import { gridPlacement, GRID_TEMPLATE } from "@/editor/renderGrid";
import { resizeBoxPx, type ResizeHandleName } from "@/editor/resize";
import { autofitRows } from "@/editor/textFit";
import type { GridBox, SizeStep } from "@/editor/types";
import { DESIGN_WIDTH, STAGE_PADDING_X } from "@/lib/editor/stage-coords";
import { Icon } from "@/components/ui/icons";
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
  handle?: ResizeHandleName;
  elementId: string;
  sectionId: string;
  startBox: GridBox;
  startPx: PxBox;
  startX: number;
  startY: number;
  pointerId: number;
  aspect: number | null;
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
  onMoveToSection,
  onAutofit,
  onReplace,
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
  onResize: (elementId: string, box: GridBox) => void;
  onAutofit?: (elementId: string, rows: number) => void;
  onMoveToSection?: (
    elementId: string,
    sectionId: string,
    col: number,
    row: number,
  ) => void;
  onReplace?: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState<DragMode | null>(null);
  const dragRef = useRef<DragMode | null>(null);
  const liveRef = useRef<GridBox | null>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const scheduleSnapRef = useRef<
    (
      mode: DragMode,
      dx: number,
      dy: number,
      alt: boolean,
      shift: boolean,
      clientX: number,
      clientY: number,
    ) => void
  >(() => {});
  const moveChipRef = useRef<HTMLDivElement>(null);
  const guidesHostRef = useRef<HTMLDivElement>(null);
  const guideRefs = useRef<Array<HTMLDivElement | null>>([]);
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

  const unitX = (designWidth - STAGE_PADDING_X * 2) / GRID_COLUMNS;
  const livePx = useRef<PxBox | null>(null);
  const dropSection = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!onAutofit || dragRef.current) return;
    const root = frameRef.current;
    if (!root) return;
    for (const element of doc.elements) {
      if (element.type !== "text") continue;
      const box = doc.layouts.find(
        (item) => item.elementId === element.id && item.breakpoint === layout,
      );
      if (!box || box.hidden) continue;
      const node = root.querySelector<HTMLElement>(
        `[data-element-id="${element.id}"] p, [data-element-id="${element.id}"] textarea`,
      );
      if (!node) continue;
      const needed = autofitRows(box.rows, node.scrollHeight);
      if (needed > box.rows) onAutofit(element.id, needed);
    }
  }, [doc, layout, onAutofit]);

  const finishDrag = useCallback(() => {
    const px = livePx.current;
    const mode = dragRef.current;
    if (!mode) return;
    const node = frameRef.current?.querySelector<HTMLElement>(
      `[data-element-id="${mode.elementId}"]`,
    );
    if (node) {
      node.style.transform = "";
      node.style.width = "";
      node.style.height = "";
      if (node.dataset.zRestore !== undefined) {
        node.style.zIndex = node.dataset.zRestore;
        delete node.dataset.zRestore;
      }
    }
    frameRef.current
      ?.querySelectorAll<HTMLElement>("[data-section]")
      .forEach((section) => {
        section.style.paddingBottom = "";
        section.style.marginBottom = "";
        section.style.outline = "";
        delete section.dataset.rowCount;
        delete section.dataset.dropTarget;
      });
    dragRef.current = null;
    liveRef.current = null;
    livePx.current = null;
    setDrag(null);
    if (!px) return;
    const committed = commitBox(px, unitX, ROW_UNIT_PX);
    const maxCol = GRID_COLUMNS - committed.span + 1;
    const box: GridBox = {
      ...committed,
      col: Math.min(maxCol, Math.max(1, committed.col)),
    };
    const target = dropSection.current;
    dropSection.current = null;
    if (
      mode.kind === "move" &&
      target &&
      target !== mode.sectionId &&
      onMoveToSection
    ) {
      onMoveToSection(mode.elementId, target, box.col, box.row);
      return;
    }
    if (mode.kind === "move") onMove(mode.elementId, box.col, box.row);
    else onResize(mode.elementId, box);
  }, [onMove, onMoveToSection, onResize, unitX]);

  const scheduleSnap = useCallback(
    (
      mode: DragMode,
      dx: number,
      dy: number,
      alt: boolean,
      shift: boolean,
      clientX: number,
      clientY: number,
    ) => {
      const designDx = dx / scale;
      const designDy = dy / scale;
      const threshold = 6 / scale;
      let px: PxBox =
        mode.kind === "resize"
          ? resizeBoxPx(mode.startPx, designDx, designDy, mode.handle ?? "se", {
              lockAspect: mode.aspect !== null ? !shift : shift,
              aspect:
                mode.aspect ??
                (mode.startPx.h > 0
                  ? mode.startPx.w / mode.startPx.h
                  : undefined),
              minW: unitX * 2,
              minH: ROW_UNIT_PX * 2,
              maxRight: designWidth - STAGE_PADDING_X * 2,
            })
          : {
              x: mode.startPx.x + designDx,
              y: mode.startPx.y + designDy,
              w: mode.startPx.w,
              h: mode.startPx.h,
            };
      const originEl = frameRef.current?.querySelector<HTMLElement>(
        `[data-section-id="${mode.sectionId}"]`,
      );
      const originWide = originEl?.dataset.siteWide === "true";
      let targetSectionId = mode.sectionId ?? "";
      frameRef.current
        ?.querySelectorAll<HTMLElement>("[data-section-id]")
        .forEach((section) => {
          const rect = section.getBoundingClientRect();
          const hit =
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom;
          if (!hit) return;
          if ((section.dataset.siteWide === "true") !== originWide) return;
          targetSectionId = section.dataset.sectionId ?? targetSectionId;
        });
      const sectionEl = frameRef.current?.querySelector<HTMLElement>(
        `[data-section-id="${targetSectionId}"]`,
      );
      const contentWidth = Math.max(
        1,
        (sectionEl?.clientWidth ?? designWidth) - STAGE_PADDING_X * 2,
      );
      const base = sectionSnapTargets(contentWidth);
      const peersX: ReturnType<typeof elementSnapTargets>["x"] = [];
      const peersY: ReturnType<typeof elementSnapTargets>["y"] = [];
      for (const item of doc.layouts) {
        if (
          item.elementId === mode.elementId ||
          item.breakpoint !== layout ||
          item.hidden
        ) {
          continue;
        }
        const owner = doc.elements.find(
          (element) => element.id === item.elementId,
        );
        if (owner?.sectionId !== targetSectionId) continue;
        const targets = elementSnapTargets({
          x: (item.col - 1) * unitX,
          y: (item.row - 1) * ROW_UNIT_PX,
          w: item.span * unitX,
          h: item.rows * ROW_UNIT_PX,
        });
        peersX.push(...targets.x);
        peersY.push(...targets.y);
      }
      const contentHeight = sectionEl
        ? Math.max(0, sectionEl.clientHeight - STAGE_PADDING_X * 2)
        : 0;
      const snapped =
        mode.kind === "move"
          ? snapPxBox(
              px,
              {
                x: [...base.x, ...peersX],
                y: [
                  { position: 0, label: "Edge" },
                  { position: contentHeight, label: "Edge" },
                  { position: contentHeight / 2, label: "Centre" },
                  ...peersY,
                ],
              },
              threshold,
              alt,
            )
          : { box: px, guides: [] as DragGuide[] };
      px = snapped.box;
      livePx.current = px;
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const frame = frameRef.current;
        const node = frame?.querySelector<HTMLElement>(
          `[data-element-id="${mode.elementId}"]`,
        );
        if (node) {
          const shiftX = px.x - mode.startPx.x;
          const shiftY = px.y - mode.startPx.y;
          node.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
          if (node.dataset.zRestore === undefined) {
            node.dataset.zRestore = node.style.zIndex;
          }
          node.style.zIndex = "10000";
          if (mode.kind === "resize") {
            node.style.width = `${px.w}px`;
            node.style.height = `${px.h}px`;
          }
          if (mode.kind === "move") {
            const section = node.closest("[data-section]");
            if (section instanceof HTMLElement) {
              if (!section.dataset.rowCount) {
                const match = /repeat\((\d+)/.exec(
                  section.style.gridTemplateRows,
                );
                section.dataset.rowCount = match?.[1] ?? "8";
              }
              const rows = Number(section.dataset.rowCount);
              const extra = Math.max(0, px.y + px.h - rows * ROW_UNIT_PX);
              section.style.paddingBottom = extra > 0 ? `${16 + extra}px` : "";
              section.style.marginBottom = extra > 0 ? `-${extra}px` : "";
            }
          }
        }
        const host = guidesHostRef.current;
        if (node && !chipRef.current) {
          raf.current = requestAnimationFrame(() =>
            scheduleSnapRef.current(mode, dx, dy, alt, shift, clientX, clientY),
          );
        }
        if (host && chipRef.current && node) {
          const guides = snapped.guides.slice(0, 4);
          host.hidden = guides.length === 0;
          const section = node.closest("[data-section]");
          const pad = section
            ? Number.parseFloat(getComputedStyle(section).paddingTop) || 0
            : 0;
          const sectionTop =
            section instanceof HTMLElement ? section.offsetTop + pad : 0;
          guideRefs.current.forEach((line, index) => {
            if (!line) return;
            const guide = guides[index];
            line.hidden = !guide;
            if (!guide) {
              delete line.dataset.guideAxis;
              delete line.dataset.guideLabel;
              return;
            }
            line.dataset.guideAxis = guide.axis;
            line.dataset.guideLabel = guide.label;
            const thickness = `${1 / scale}px`;
            if (guide.axis === "y") {
              line.style.left = `${STAGE_PADDING_X}px`;
              line.style.top = `${sectionTop + guide.position}px`;
              line.style.width = `calc(100% - ${STAGE_PADDING_X * 2}px)`;
              line.style.height = thickness;
            } else {
              line.style.top = `${sectionTop}px`;
              line.style.left = `${STAGE_PADDING_X + guide.position}px`;
              line.style.width = thickness;
              line.style.height =
                section instanceof HTMLElement
                  ? `${section.clientHeight - pad * 2}px`
                  : "100%";
            }
          });
          const label = guides[0]?.label ?? "";
          chipRef.current.hidden = mode.kind === "move" ? !label : false;
          chipRef.current.textContent =
            mode.kind === "resize"
              ? `${Math.round(px.w)} × ${Math.round(px.h)}`
              : label;
          const rect = node.getBoundingClientRect();
          const frameRect = frame!.getBoundingClientRect();
          chipRef.current.style.left = `${(rect.left - frameRect.left) / scale}px`;
          chipRef.current.style.top = `${(rect.top - frameRect.top) / scale - 28}px`;
        }
        const sections =
          frame?.querySelectorAll<HTMLElement>("[data-section-id]") ?? [];
        let hovered: string | null = null;
        sections.forEach((section) => {
          const rect = section.getBoundingClientRect();
          const hit =
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom;
          const id = section.dataset.sectionId ?? "";
          const siteWide = section.dataset.siteWide === "true";
          const originWide = mode.sectionId
            ? frame
                ?.querySelector(`[data-section-id="${mode.sectionId}"]`)
                ?.getAttribute("data-site-wide") === "true"
            : false;
          const allowed =
            hit && siteWide === originWide && id !== mode.sectionId;
          section.dataset.dropTarget = allowed ? "true" : "false";
          section.style.outline = allowed ? "1px solid var(--ink)" : "";
          if (allowed) hovered = id;
        });
        dropSection.current = mode.kind === "move" ? hovered : null;
        if (moveChipRef.current) {
          const target = hovered
            ? frame?.querySelector<HTMLElement>(
                `[data-section-id="${hovered}"]`,
              )
            : null;
          moveChipRef.current.hidden = !target;
          if (target) {
            moveChipRef.current.textContent = `Move to ${target.dataset.section ?? "section"}`;
            const rect = target.getBoundingClientRect();
            const frameRect = frame!.getBoundingClientRect();
            moveChipRef.current.style.left = `${(rect.left - frameRect.left) / scale + 12}px`;
            moveChipRef.current.style.top = `${(rect.top - frameRect.top) / scale + 12}px`;
          }
        }
      });
    },
    [designWidth, doc.elements, doc.layouts, layout, scale, unitX],
  );
  useEffect(() => {
    scheduleSnapRef.current = scheduleSnap;
  }, [scheduleSnap]);

  const beginDrag = useCallback(
    (
      mode: Omit<DragMode, "startX" | "startY" | "pointerId">,
      event: ReactPointerEvent,
      origin?: { x: number; y: number },
    ) => {
      const full: DragMode = {
        ...mode,
        startX: origin?.x ?? event.clientX,
        startY: origin?.y ?? event.clientY,
        pointerId: event.pointerId,
      };
      dragRef.current = full;
      setDrag(full);
      scheduleSnap(
        full,
        event.clientX - full.startX,
        event.clientY - full.startY,
        event.altKey,
        event.shiftKey,
        event.clientX,
        event.clientY,
      );
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== full.pointerId) return;
        scheduleSnap(
          full,
          ev.clientX - full.startX,
          ev.clientY - full.startY,
          ev.altKey,
          ev.shiftKey,
          ev.clientX,
          ev.clientY,
        );
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        window.removeEventListener("mouseup", up);
        finishDrag();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      window.addEventListener("mouseup", up);
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
          data-stage-scale={scale}
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
              data-section-id={section.id}
              data-site-wide={section.pageId === null ? "true" : "false"}
              className="relative grid px-8 py-4"
              style={{
                gridTemplateColumns: GRID_TEMPLATE,
                gridTemplateRows: `repeat(${Math.max(
                  8,
                  ...elementsIn(doc, section.id).map((element) => {
                    const item = doc.layouts.find(
                      (layoutItem) =>
                        layoutItem.elementId === element.id &&
                        layoutItem.breakpoint === layout,
                    );
                    return item && !item.hidden ? item.row + item.rows - 1 : 0;
                  }),
                )}, ${ROW_UNIT_PX}px)`,
              }}
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
                    onReplace={onReplace}
                    onStartMove={(startBox, event, origin) =>
                      beginDrag(
                        {
                          kind: "move",
                          elementId: element.id,
                          sectionId: section.id,
                          startBox,
                          startPx: {
                            x: (startBox.col - 1) * unitX,
                            y: (startBox.row - 1) * ROW_UNIT_PX,
                            w: startBox.span * unitX,
                            h: startBox.rows * ROW_UNIT_PX,
                          },
                          aspect:
                            element.type === "image" && startBox.rows > 0
                              ? (startBox.span * unitX) /
                                (startBox.rows * ROW_UNIT_PX)
                              : null,
                        },
                        event,
                        origin,
                      )
                    }
                    onGestureEnd={finishDrag}
                    onStartResize={(startBox, event, handle) =>
                      beginDrag(
                        {
                          kind: "resize",
                          handle,
                          elementId: element.id,
                          sectionId: section.id,
                          startBox,
                          startPx: {
                            x: (startBox.col - 1) * unitX,
                            y: (startBox.row - 1) * ROW_UNIT_PX,
                            w: startBox.span * unitX,
                            h: startBox.rows * ROW_UNIT_PX,
                          },
                          aspect:
                            element.type === "image"
                              ? (startBox.span * unitX) /
                                (startBox.rows * ROW_UNIT_PX)
                              : null,
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
                ref={guidesHostRef}
                data-drag-guides=""
                hidden
                className="pointer-events-none absolute inset-0 z-10"
              >
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    ref={(node) => {
                      guideRefs.current[index] = node;
                    }}
                    hidden
                    className="absolute bg-ink"
                  />
                ))}
              </div>
              <div
                ref={chipRef}
                data-drag-readout=""
                className="pointer-events-none absolute z-20 rounded bg-ink px-1.5 py-0.5 text-xs text-bg"
              />
              <div
                ref={moveChipRef}
                data-move-chip=""
                hidden
                className="pointer-events-none absolute z-20 rounded bg-ink px-1.5 py-0.5 text-xs text-bg"
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ResizeHandle({
  corner,
  scale,
  onPointerDown,
}: {
  corner: ResizeHandleName;
  scale: number;
  onPointerDown: (event: ReactPointerEvent) => void;
}) {
  const hit = 24 / scale;
  const visible = 8 / scale;
  const cursor =
    corner === "n" || corner === "s"
      ? "ns-resize"
      : corner === "e" || corner === "w"
        ? "ew-resize"
        : corner === "nw" || corner === "se"
          ? "nwse-resize"
          : "nesw-resize";
  const edge =
    corner === "nw"
      ? { left: -hit / 2, top: -hit / 2 }
      : corner === "ne"
        ? { right: -hit / 2, top: -hit / 2 }
        : corner === "sw"
          ? { left: -hit / 2, bottom: -hit / 2 }
          : corner === "se"
            ? { right: -hit / 2, bottom: -hit / 2 }
            : corner === "n"
              ? { left: `calc(50% - ${hit / 2}px)`, top: -hit / 2 }
              : corner === "s"
                ? { left: `calc(50% - ${hit / 2}px)`, bottom: -hit / 2 }
                : corner === "w"
                  ? { left: -hit / 2, top: `calc(50% - ${hit / 2}px)` }
                  : { right: -hit / 2, top: `calc(50% - ${hit / 2}px)` };
  return (
    <span
      data-resize-handle=""
      data-corner={corner}
      data-handle={corner}
      className="absolute z-30 flex items-center justify-center"
      style={{ width: hit, height: hit, cursor, ...edge }}
      onPointerDown={onPointerDown}
    >
      <span
        className="border-ink bg-bg"
        style={{
          width: visible,
          height: visible,
          borderWidth: 1 / scale,
          borderStyle: "solid",
          boxSizing: "border-box",
        }}
      />
    </span>
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
  onGestureEnd,
  onReplace,
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
  onStartMove: (
    box: GridBox,
    event: ReactPointerEvent,
    origin: { x: number; y: number },
  ) => void;
  onStartResize: (
    box: GridBox,
    event: ReactPointerEvent,
    corner: ResizeHandleName,
  ) => void;
  onGestureEnd: () => void;
  onReplace?: () => void;
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
    onStartMove(box, event, {
      x: moveOrigin.current.x,
      y: moveOrigin.current.y,
    });
  };
  const endGesture = (event: ReactPointerEvent) => {
    moveOrigin.current = null;
    const node = event.currentTarget;
    if (node.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }
    onGestureEnd();
  };

  return (
    <div
      data-element={element.name}
      data-element-id={element.id}
      data-col={box.col}
      data-span={box.span}
      data-row={box.row}
      data-rows={box.rows}
      tabIndex={focused ? 0 : -1}
      className={cn(
        "relative min-w-0 outline-none",
        selected && "outline outline-1 outline-ink",
        focused && "ring-1 ring-brand",
      )}
      style={{ ...style, touchAction: "none", zIndex: style.zIndex }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onLostPointerCapture={() => {
        moveOrigin.current = null;
      }}
      onDoubleClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      {selected
        ? (["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map(
            (corner) => (
              <ResizeHandle
                key={corner}
                corner={corner}
                scale={scale}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  onStartResize(box, event, corner);
                }}
              />
            ),
          )
        : null}
      {element.type === "text" ? (
        editing ? (
          <textarea
            autoFocus
            defaultValue={text}
            className="w-full bg-transparent text-ink outline-none"
            style={{ fontSize: shown, lineHeight }}
            onFocus={(event) => {
              if (element.content.sample === true) event.currentTarget.select();
            }}
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
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full min-h-16 items-center justify-center rounded-control bg-surface-2 text-xs text-ink-2">
            {element.name}
          </div>
        )
      ) : null}
      {selected &&
      element.type === "image" &&
      element.content.sample === true &&
      onReplace ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onReplace();
          }}
          className="absolute top-4 left-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 text-[13px] leading-4 font-medium text-ink shadow-float"
        >
          <Icon name="image" size={14} />
          Replace image
        </button>
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
