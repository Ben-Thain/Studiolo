/**
 * Desktop → mobile font sizes (prompt 05). Sizes 24 and below stay unchanged.
 */

import type { SizeStep } from "./types";

export const MOBILE_FONT_SIZE: Record<number, number> = {
  108: 64,
  96: 48,
  80: 48,
  64: 40,
  48: 32,
  40: 28,
  32: 24,
};

export const SIZE_STEPS: SizeStep[] = [
  13, 16, 18, 24, 32, 40, 48, 64, 80, 96, 108,
];

export const FONT_FAMILIES = ["Inter", "Georgia", "Times New Roman"] as const;

/** Map a desktop text size to the mobile canvas size (minimum 16). */
export function mobileFontSize(desktopSize: number): number {
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
