/**
 * Desktop → mobile font sizes (prompt 05). Sizes 24 and below stay unchanged.
 */

export const MOBILE_FONT_SIZE: Record<number, number> = {
  108: 64,
  96: 48,
  80: 48,
  64: 40,
  48: 32,
  40: 28,
  32: 24,
};

/** Map a desktop text size to the mobile canvas size. */
export function mobileFontSize(desktopSize: number): number {
  return MOBILE_FONT_SIZE[desktopSize] ?? desktopSize;
}