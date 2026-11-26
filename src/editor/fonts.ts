/**
 * Desktop → mobile font sizes and allowed text tokens (prompt 05).
 */

import type { FontFamily, SizeStep } from "./types";

/** Desktop sizes at or below 24 stay unchanged on mobile (minimum 16). */
export const MOBILE_FONT_SIZE: Record<number, number> = {
  108: 64,
  96: 48,
  80: 48,
  64: 40,
  48: 32,
  40: 28,
  32: 24,
  28: 24,
};

export const SIZE_STEPS = [
  12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 40, 48, 64, 80, 96, 108,
] as const satisfies readonly SizeStep[];

export const FONT_FAMILIES = [
  "Inter",
  "Geist",
  "Manrope",
  "Instrument Serif",
] as const satisfies readonly FontFamily[];

/**
 * One type table for the stage, the template preview and auto-stack.
 * lineHeight is the CSS ratio (line box px / font size). tracking is em.
 */
export const TYPE_METRICS: Record<
  number,
  { lineHeight: number; tracking: string }
> = {
  12: { lineHeight: 16 / 12, tracking: "0em" },
  13: { lineHeight: 18 / 13, tracking: "0em" },
  14: { lineHeight: 20 / 14, tracking: "0em" },
  16: { lineHeight: 26 / 16, tracking: "0em" },
  18: { lineHeight: 26 / 18, tracking: "0em" },
  20: { lineHeight: 30 / 20, tracking: "0em" },
  22: { lineHeight: 30 / 22, tracking: "0em" },
  24: { lineHeight: 32 / 24, tracking: "0em" },
  28: { lineHeight: 36 / 28, tracking: "-0.016em" },
  32: { lineHeight: 40 / 32, tracking: "-0.016em" },
  40: { lineHeight: 46 / 40, tracking: "-0.022em" },
  48: { lineHeight: 54 / 48, tracking: "-0.022em" },
  64: { lineHeight: 68 / 64, tracking: "-0.03em" },
  80: { lineHeight: 84 / 80, tracking: "-0.03em" },
  96: { lineHeight: 100 / 96, tracking: "-0.03em" },
  108: { lineHeight: 112 / 108, tracking: "-0.03em" },
};

export function typeMetrics(size: number): {
  lineHeight: number;
  tracking: string;
} {
  return TYPE_METRICS[size] ?? { lineHeight: 1.5, tracking: "0em" };
}

/** Map a desktop text size to the mobile canvas size (minimum 16). */
export function mobileFontSize(desktopSize: number): number {
  if (desktopSize <= 24) return Math.max(16, desktopSize);
  const mapped = MOBILE_FONT_SIZE[desktopSize] ?? desktopSize;
  return Math.max(16, mapped);
}

export function nearestSizeStep(size: number): SizeStep {
  let best: SizeStep = SIZE_STEPS[0];
  let dist = Math.abs(size - best);
  for (const step of SIZE_STEPS) {
    const d = Math.abs(size - step);
    if (d < dist) {
      best = step;
      dist = d;
    }
  }
  return best;
}
