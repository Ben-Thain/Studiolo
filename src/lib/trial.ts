/**
 * The 7-day Pro trial (prompt 03). Display only: nothing reads these to
 * block, lock or limit anything, and profiles.plan stays dormant.
 */

export const TRIAL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type TrialProfile = { trial_started_at: string };

export function trialStartedAt(profile: TrialProfile): Date {
  return new Date(profile.trial_started_at);
}

/** trial_started_at + 7 days. */
export function trialEndsAt(profile: TrialProfile): Date {
  return new Date(trialStartedAt(profile).getTime() + TRIAL_DAYS * DAY_MS);
}

/** Whole days left, rounded up, never below 0. */
export function trialDaysLeft(
  profile: TrialProfile,
  now: Date = new Date(),
): number {
  const left = (trialEndsAt(profile).getTime() - now.getTime()) / DAY_MS;
  if (!Number.isFinite(left)) return 0;
  return Math.min(TRIAL_DAYS, Math.max(0, Math.ceil(left)));
}

export function isTrialActive(
  profile: TrialProfile,
  now: Date = new Date(),
): boolean {
  return trialEndsAt(profile).getTime() > now.getTime();
}

/** Share of the trial used, 0 to 1, for the Plan progress bar. */
export function trialElapsed(
  profile: TrialProfile,
  now: Date = new Date(),
): number {
  const start = trialStartedAt(profile).getTime();
  const used = (now.getTime() - start) / (TRIAL_DAYS * DAY_MS);
  if (!Number.isFinite(used)) return 1;
  return Math.min(1, Math.max(0, used));
}

/** Sidebar trial line: "Trial · 5 days left", "Trial · 1 day left" or "Trial ended". */
export function trialLineText(
  profile: TrialProfile,
  now: Date = new Date(),
): string {
  if (!isTrialActive(profile, now)) return "Trial ended";
  const days = trialDaysLeft(profile, now);
  return `Trial · ${days} ${days === 1 ? "day" : "days"} left`;
}
