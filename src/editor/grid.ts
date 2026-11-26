/**
 * The editor grid: 96 columns, 8px row units (prompt 06c).
 * Design-column guides are every 8 units (the old 12-column lines).
 */

import type { GridBox } from "./types";

export const GRID_COLUMNS = 96;
export const DESIGN_COLUMNS = 12;
export const ROW_UNIT_PX = 8;
/** Content width the 12-column templates were drawn on (1440 minus 32px sides). */
export const LEGACY_CONTENT_PX = 1376;
export const MOBILE_STACK_GAP_ROWS = 3;

export const DEFAULT_TEXT_ROWS = 6;
export const DEFAULT_IMAGE_ROWS = 40;
export const DEFAULT_NAV_ROWS = 4;

/** Fraction of a column/row within which a guide magnetizes. */
export const SNAP_THRESHOLD = 0.45;

export type SnapGuide = {
  axis: "x" | "y";
  position: number;
  label: string;
};

export type SnapReadout = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export type SnapResult = {
  box: GridBox;
  guides: SnapGuide[];
  readout: SnapReadout;
};

export function snapCol(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(GRID_COLUMNS, Math.max(1, Math.round(value)));
}

export function snapSpan(value: number, col: number): number {
  if (!Number.isFinite(value)) return 1;
  const span = Math.max(1, Math.round(value));
  return Math.min(span, GRID_COLUMNS - col + 1);
}

export function snapRow(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

export function snapRowSpan(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

/** Fit a box into the grid, snapping every field. */
export function snapBox(box: GridBox): GridBox {
  const col = snapCol(box.col);
  return {
    col,
    span: snapSpan(box.span, col),
    row: snapRow(box.row),
    rows: snapRowSpan(box.rows),
    ...(box.z === undefined ? {} : { z: box.z }),
  };
}

/**
 * Map a 12-column box (24px gutter, 1376px content) onto the gutterless
 * 96-unit grid. The same expression is in 0011_free_editor.sql.
 */
export function legacy12To96(box: { col: number; span: number }): {
  col: number;
  span: number;
} {
  const u = LEGACY_CONTENT_PX / GRID_COLUMNS;
  const start = Math.round(((box.col - 1) * 116.6667) / u) + 1;
  const end = Math.min(
    97,
    Math.round(
      ((box.col - 1) * 116.6667 + box.span * 92.6667 + (box.span - 1) * 24) / u,
    ) + 1,
  );
  return { col: start, span: end - start };
}

function nearestSnap(
  value: number,
  targets: { position: number; label: string }[],
  threshold: number,
): { value: number; guide: SnapGuide | null } {
  let best = value;
  let bestDist = threshold + 1;
  let guide: SnapGuide | null = null;
  for (const target of targets) {
    const dist = Math.abs(value - target.position);
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      best = target.position;
      guide = {
        axis: "x",
        position: target.position,
        label: target.label,
      };
    }
  }
  return { value: best, guide };
}

function colTargets(box: GridBox, others: GridBox[], section?: GridBox) {
  const targets: { position: number; label: string }[] = [];
  for (let c = 1; c <= GRID_COLUMNS; c += 1) {
    targets.push({ position: c, label: `col ${c}` });
  }
  for (const o of others) {
    targets.push(
      { position: o.col, label: "edge" },
      { position: o.col + o.span, label: "edge" },
      { position: o.col + o.span / 2, label: "center" },
    );
  }
  if (section) {
    targets.push(
      { position: section.col, label: "section" },
      {
        position: section.col + section.span,
        label: "section",
      },
      {
        position: section.col + section.span / 2,
        label: "section center",
      },
    );
  }
  return targets;
}

function rowTargets(box: GridBox, others: GridBox[], section?: GridBox) {
  const targets: { position: number; label: string }[] = [];
  for (const o of others) {
    targets.push(
      { position: o.row, label: "edge" },
      { position: o.row + o.rows, label: "edge" },
      { position: o.row + o.rows / 2, label: "center" },
    );
  }
  if (section) {
    targets.push(
      { position: section.row, label: "section" },
      { position: section.row + section.rows, label: "section" },
      {
        position: section.row + section.rows / 2,
        label: "section center",
      },
    );
  }
  return targets;
}

/** Snap a moving box to the grid, peers and section guides. */
export function snapLayout(
  box: GridBox,
  others: GridBox[],
  options?: { section?: GridBox; threshold?: number },
): SnapResult {
  const threshold = options?.threshold ?? SNAP_THRESHOLD;
  const snapped = snapBox(box);
  const guides: SnapGuide[] = [];

  const colSnap = nearestSnap(
    snapped.col,
    colTargets(snapped, others, options?.section),
    threshold,
  );
  const colEndSnap = nearestSnap(
    snapped.col + snapped.span,
    colTargets(snapped, others, options?.section).map((t) => ({
      ...t,
      position: t.position,
    })),
    threshold,
  );

  const col = colSnap.value;
  let span = snapped.span;
  if (colEndSnap.guide && !colSnap.guide) {
    span = Math.max(1, Math.round(colEndSnap.value - col));
  }
  for (const guide of [colSnap.guide, colEndSnap.guide]) {
    if (!guide || guides.filter((item) => item.axis === "x").length >= 2) {
      continue;
    }
    guides.push({ ...guide, axis: "x" });
  }

  const rowSnap = nearestSnap(
    snapped.row,
    rowTargets(snapped, others, options?.section),
    threshold,
  );
  const rowEndSnap = nearestSnap(
    snapped.row + snapped.rows,
    rowTargets(snapped, others, options?.section),
    threshold,
  );

  const row = rowSnap.value;
  let rows = snapped.rows;
  if (rowEndSnap.guide && !rowSnap.guide) {
    rows = Math.max(1, Math.round(rowEndSnap.value - row));
  }
  for (const guide of [rowSnap.guide, rowEndSnap.guide]) {
    if (!guide || guides.filter((item) => item.axis === "y").length >= 2) {
      continue;
    }
    guides.push({ ...guide, axis: "y" });
  }

  const out = snapBox({ col, span, row, rows });
  const readout: SnapReadout = {
    x: out.col,
    y: out.row,
    w: out.span,
    h: out.rows,
    label: guides.map((g) => g.label).join(", ") || "grid",
  };
  return { box: out, guides, readout };
}

/** Snap only to column grid lines. */
export function snapToGrid(
  box: GridBox,
  threshold = SNAP_THRESHOLD,
): SnapResult {
  return snapLayout(box, [], { threshold });
}

/** Snap to another element's edges and center. */
export function snapToElement(
  box: GridBox,
  target: GridBox,
  threshold = SNAP_THRESHOLD,
): SnapResult {
  return snapLayout(box, [target], { threshold });
}

/** Snap to section bounds. */
export function snapToSection(
  box: GridBox,
  section: GridBox,
  threshold = SNAP_THRESHOLD,
): SnapResult {
  return snapLayout(box, [], { section, threshold });
}

/** The first row after the bottom of `boxes`, plus optional gap rows. */
export function rowBelow(boxes: GridBox[], gapRows = 0): number {
  if (boxes.length === 0) return 1;
  const end = Math.max(...boxes.map((b) => b.row + b.rows));
  return end + gapRows;
}

/** Default desktop column span for a new element type. */
export function defaultDesktopSpan(type: "text" | "image" | "nav" | "form"): {
  col: number;
  span: number;
} {
  // The old 12-column defaults, converted so a new box keeps its pixel size.
  if (type === "image") return legacy12To96({ col: 7, span: 6 });
  return legacy12To96({ col: 1, span: 6 });
}

export function defaultDesktopRows(
  type: "text" | "image" | "nav" | "form",
): number {
  switch (type) {
    case "image":
      return DEFAULT_IMAGE_ROWS;
    case "nav":
      return DEFAULT_NAV_ROWS;
    case "form":
      return DEFAULT_IMAGE_ROWS;
    default:
      return DEFAULT_TEXT_ROWS;
  }
}

export function boxesOverlap(a: GridBox, b: GridBox): boolean {
  const aColEnd = a.col + a.span;
  const bColEnd = b.col + b.span;
  const aRowEnd = a.row + a.rows;
  const bRowEnd = b.row + b.rows;
  return (
    a.col < bColEnd && aColEnd > b.col && a.row < bRowEnd && aRowEnd > b.row
  );
}
