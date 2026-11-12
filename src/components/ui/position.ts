export type FloatingAlign = "start" | "end";

export type FloatingBox = {
  top: number;
  left: number;
  maxHeight: number;
};

type TriggerRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export function placeFloating({
  trigger,
  panel,
  gap,
  viewport,
  margin = 8,
  align = "end",
}: {
  trigger: TriggerRect;
  panel: { width: number; height: number };
  gap: number;
  viewport: { width: number; height: number };
  margin?: number;
  align?: FloatingAlign;
}): FloatingBox {
  const cap = Math.max(0, viewport.height - margin * 2);
  let left = align === "end" ? trigger.right - panel.width : trigger.left;
  const maxLeft = Math.max(margin, viewport.width - margin - panel.width);
  left = Math.min(Math.max(left, margin), maxLeft);

  const belowTop = trigger.bottom + gap;
  const spaceBelow = viewport.height - margin - belowTop;
  const spaceAbove = trigger.top - gap - margin;
  const placeBelow = spaceBelow >= panel.height || spaceBelow >= spaceAbove;

  const maxHeight = placeBelow
    ? Math.max(0, Math.min(cap, spaceBelow))
    : Math.max(0, Math.min(cap, spaceAbove));
  const height = Math.min(panel.height, maxHeight || panel.height);
  let top = placeBelow ? belowTop : trigger.top - gap - height;
  const maxTop = Math.max(margin, viewport.height - margin - height);
  const triggerVisible = trigger.bottom > margin && trigger.top < viewport.height - margin;
  const menuIntersects = top < viewport.height - margin && top + height > margin;
  if ((triggerVisible || menuIntersects) && (top < margin || top > maxTop)) {
    top = Math.min(Math.max(top, margin), maxTop);
  }

  return { top, left, maxHeight: maxHeight || cap };
}
