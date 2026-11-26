/** Signed read URLs last 3600s. Refresh this long before they expire. */
export const READ_URL_TTL_SECONDS = 3600;
export const READ_URL_REFRESH_LEAD_MS = 60_000;

export function readUrlRefreshDelayMs(
  expiresAtSec: number,
  nowMs: number,
): number {
  const refreshAt = expiresAtSec * 1000 - READ_URL_REFRESH_LEAD_MS;
  return Math.max(0, refreshAt - nowMs);
}
