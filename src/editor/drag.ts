/**
 * Pointer drag in design pixels. No React, no DOM.
 * A guide pulls only within `threshold` (6 screen px, already divided by scale).
 */

import { DESIGN_COLUMNS, GRID_COLUMNS, ROW_UNIT_PX } from "./grid";

export type GuideLabel = "Centre" | "Edge" | "Column";

export type SnapTarget = {
  position: number;
  label: GuideLabel;
};

export type DragGuide = {
  axis: "x" | "y";
  /** Section content coordinates: 0 is the content box's left or top. */
  position: number;
  label: GuideLabel;
};

export type PxBox = { x: number; y: number; w: number; h: number };

export function magnet(
  px: number,
  targets: SnapTarget[],
  threshold: number,
): { value: number; guide: SnapTarget | null } {
  let value = px;
  let best = threshold;
  let guide: SnapTarget | null = null;
  for (const target of targets) {
    const dist = Math.abs(px - target.position);
    if (dist <= threshold && dist < best) {
      best = dist;
      value = target.position;
      guide = target;
    } else if (dist <= threshold && dist === best && guide === null) {
      value = target.position;
      guide = target;
    }
  }
  return { value, guide };
}

/** Round a design-pixel position to the nearest unit. At most half a unit away. */
export function pxToUnits(px: number, unit: number): number {
  if (!Number.isFinite(px) || unit <= 0) return 0;
  return Math.round(px / unit) * unit;
}

/** Column or row index (1-based) for a design-pixel origin. */
export function originToIndex(px: number, unit: number): number {
  return Math.max(1, Math.round(px / unit) + 1);
}

/** Span in units for a design-pixel size. Minimum 2. */
export function sizeToSpan(px: number, unit: number, min = 2): number {
  if (!Number.isFinite(px) || unit <= 0) return min;
  return Math.max(min, Math.round(px / unit));
}

export function sectionSnapTargets(contentWidth: number): {
  x: SnapTarget[];
  y: SnapTarget[];
} {
  const unit = contentWidth / GRID_COLUMNS;
  const x: SnapTarget[] = [
    { position: 0, label: "Edge" },
    { position: contentWidth, label: "Edge" },
    { position: contentWidth / 2, label: "Centre" },
  ];
  for (let i = 1; i < DESIGN_COLUMNS; i += 1) {
    x.push({
      position: i * (GRID_COLUMNS / DESIGN_COLUMNS) * unit,
      label: "Column",
    });
  }
  return { x, y: [] };
}

export function elementSnapTargets(box: PxBox): {
  x: SnapTarget[];
  y: SnapTarget[];
} {
  return {
    x: [
      { position: box.x, label: "Edge" },
      { position: box.x + box.w, label: "Edge" },
      { position: box.x + box.w / 2, label: "Centre" },
    ],
    y: [
      { position: box.y, label: "Edge" },
      { position: box.y + box.h, label: "Edge" },
      { position: box.y + box.h / 2, label: "Centre" },
    ],
  };
}

function snapAxis(
  origin: number,
  size: number,
  targets: SnapTarget[],
  threshold: number,
): { origin: number; guides: DragGuide[] } {
  const points = [0, size / 2, size];
  let bestShift = 0;
  let bestDist = threshold + 1;
  const guides: DragGuide[] = [];
  for (const offset of points) {
    const hit = magnet(origin + offset, targets, threshold);
    if (!hit.guide) continue;
    const shift = hit.value - (origin + offset);
    const dist = Math.abs(shift);
    if (dist < bestDist) {
      bestDist = dist;
      bestShift = shift;
    }
    if (guides.length < 2) {
      guides.push({
        axis: "x",
        position: hit.value,
        label: hit.guide.label,
      });
    }
  }
  if (bestDist > threshold) return { origin, guides: [] };
  return { origin: origin + bestShift, guides };
}

/**
 * Magnetise a box to the given section-local targets.
 * `alt` turns snapping off. Guides are only returned when something snapped.
 */
export function snapPxBox(
  box: PxBox,
  targets: { x: SnapTarget[]; y: SnapTarget[] },
  threshold: number,
  alt = false,
): { box: PxBox; guides: DragGuide[] } {
  if (alt || threshold <= 0) return { box, guides: [] };
  const x = snapAxis(box.x, box.w, targets.x, threshold);
  const y = snapAxis(box.y, box.h, targets.y, threshold);
  return {
    box: { ...box, x: x.origin, y: y.origin },
    guides: [
      ...x.guides.map((guide) => ({ ...guide, axis: "x" as const })),
      ...y.guides.map((guide) => ({ ...guide, axis: "y" as const })),
    ],
  };
}

export function commitBox(
  box: PxBox,
  unitX: number,
  unitY: number = ROW_UNIT_PX,
): { col: number; span: number; row: number; rows: number } {
  const x = pxToUnits(box.x, unitX);
  const y = pxToUnits(box.y, unitY);
  const w = pxToUnits(box.w, unitX);
  const h = pxToUnits(box.h, unitY);
  return {
    col: Math.max(1, Math.round(x / unitX) + 1),
    span: Math.max(2, Math.round(w / unitX)),
    row: Math.max(1, Math.round(y / unitY) + 1),
    rows: Math.max(2, Math.round(h / unitY)),
  };
}
