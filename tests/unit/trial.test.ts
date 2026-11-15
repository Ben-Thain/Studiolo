import { describe, expect, it } from "vitest";
import {
  isTrialActive,
  trialDaysLeft,
  trialElapsed,
  trialEndsAt,
  trialLineText,
} from "@/lib/trial";

const started = { trial_started_at: "2026-11-09T10:00:00.000Z" };
const at = (iso: string) => new Date(iso);

describe("trial", () => {
  it("ends 7 days after it starts", () => {
    expect(trialEndsAt(started).toISOString()).toBe("2026-11-16T10:00:00.000Z");
  });

  it("counts whole days left, rounded up", () => {
    expect(trialDaysLeft(started, at("2026-11-09T10:00:00Z"))).toBe(7);
    expect(trialDaysLeft(started, at("2026-11-09T10:00:01Z"))).toBe(7);
    expect(trialDaysLeft(started, at("2026-11-11T10:00:00Z"))).toBe(5);
    expect(trialDaysLeft(started, at("2026-11-11T11:00:00Z"))).toBe(5);
    expect(trialDaysLeft(started, at("2026-11-15T10:00:01Z"))).toBe(1);
    expect(trialDaysLeft(started, at("2026-11-16T09:59:59Z"))).toBe(1);
  });

  it("never goes below 0 or above 7", () => {
    expect(trialDaysLeft(started, at("2026-11-16T10:00:00Z"))).toBe(0);
    expect(trialDaysLeft(started, at("2027-01-01T00:00:00Z"))).toBe(0);
    expect(trialDaysLeft(started, at("2026-11-01T00:00:00Z"))).toBe(7);
    expect(trialDaysLeft({ trial_started_at: "nonsense" })).toBe(0);
  });

  it("is active until the end instant", () => {
    expect(isTrialActive(started, at("2026-11-16T09:59:59Z"))).toBe(true);
    expect(isTrialActive(started, at("2026-11-16T10:00:00Z"))).toBe(false);
  });

  it("reports the share used for the progress bar", () => {
    expect(trialElapsed(started, at("2026-11-09T10:00:00Z"))).toBe(0);
    expect(trialElapsed(started, at("2026-11-11T10:00:00Z"))).toBeCloseTo(
      2 / 7,
    );
    expect(trialElapsed(started, at("2026-12-01T00:00:00Z"))).toBe(1);
  });

  it("words the sidebar trial line", () => {
    expect(trialLineText(started, at("2026-11-11T10:00:00Z"))).toBe(
      "Trial · 5 days left",
    );
    expect(trialLineText(started, at("2026-11-15T12:00:00Z"))).toBe(
      "Trial · 1 day left",
    );
    expect(trialLineText(started, at("2026-11-16T10:00:00Z"))).toBe(
      "Trial ended",
    );
  });
});
