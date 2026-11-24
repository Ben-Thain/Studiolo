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
