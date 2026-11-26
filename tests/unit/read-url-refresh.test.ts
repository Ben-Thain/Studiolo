import { describe, expect, it } from "vitest";
import {
  READ_URL_REFRESH_LEAD_MS,
  READ_URL_TTL_SECONDS,
  readUrlRefreshDelayMs,
} from "@/lib/assets/read-url-refresh";

describe("readUrlRefreshDelayMs", () => {
  it("refreshes a 3600s signed URL one minute before it expires", () => {
    const now = 1_700_000_000_000;
    const expiresAt = Math.floor(now / 1000) + READ_URL_TTL_SECONDS;
    expect(readUrlRefreshDelayMs(expiresAt, now)).toBe(
      READ_URL_TTL_SECONDS * 1000 - READ_URL_REFRESH_LEAD_MS,
    );
  });

  it("refreshes immediately once the lead window has started", () => {
    const now = 1_700_000_000_000;
    const expiresAt = Math.floor(now / 1000) + 30;
    expect(readUrlRefreshDelayMs(expiresAt, now)).toBe(0);
  });
});
