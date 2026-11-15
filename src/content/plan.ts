import type { IconName } from "@/components/ui/icons";

/**
 * Plan page copy (prompt 03, d-plan.png). Unconfirmed by Ben: change it here
 * only. No prices, buttons or payment links, and nothing here locks anything.
 */
export const PLAN_COPY = {
  title: "Plan",
  lead: "Your trial includes everything in Pro.",
  trialName: "Pro trial",
  daysLeft: (days: number, total: number) => `${days} of ${total} days left`,
  ended: "Trial ended",
  /** Followed by the date, e.g. "Started 9 Nov". */
  started: "Started",
  ends: "Ends",
  endedOn: "Ended",
  includedTitle: "Included",
  included: [
    { icon: "globe", label: "Sites, pages and custom domains" },
    { icon: "lock", label: "Password-protected sites" },
    { icon: "mail", label: "Contact form and submissions" },
    { icon: "chart", label: "Stats" },
  ] satisfies { icon: IconName; label: string }[],
  foot: "Nothing locks when the trial ends yet. Paid plans aren't available.",
} as const;
