import type { Metadata } from "next";
import { LocalDate } from "@/components/home/local-date";
import { Icon } from "@/components/ui/icons";
import { PageHead } from "@/components/ui/page-head";
import { PLAN_COPY } from "@/content/plan";
import { getHomeContext } from "@/lib/home/data";
import {
  TRIAL_DAYS,
  isTrialActive,
  trialDaysLeft,
  trialElapsed,
  trialEndsAt,
} from "@/lib/trial";

export const metadata: Metadata = { title: "Plan · Studiolo" };

// Display only: the trial never blocks anything, and there is nothing to buy.
export default async function PlanPage() {
  const { profile } = await getHomeContext("/plan");
  const now = new Date();
  const active = isTrialActive(profile, now);
  const daysLeft = trialDaysLeft(profile, now);
  const elapsed = trialElapsed(profile, now);
  const ends = trialEndsAt(profile).toISOString();

  return (
    <>
      <PageHead
        size="responsive"
        title={PLAN_COPY.title}
        lead={PLAN_COPY.lead}
      />
      <div className="max-w-[640px]">
        <section aria-labelledby="plan-trial">
          <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-4">
            <h2
              id="plan-trial"
              className="text-xl leading-7 font-medium tracking-[-0.01em] text-ink"
            >
              {PLAN_COPY.trialName}
            </h2>
            <p className="text-sm leading-5 text-ink-2">
              {active
                ? PLAN_COPY.daysLeft(daysLeft, TRIAL_DAYS)
                : PLAN_COPY.ended}
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="Trial used"
            aria-valuemin={0}
            aria-valuemax={TRIAL_DAYS}
            aria-valuenow={TRIAL_DAYS - daysLeft}
            aria-valuetext={
              active
                ? PLAN_COPY.daysLeft(daysLeft, TRIAL_DAYS)
                : PLAN_COPY.ended
            }
            className="mt-4 h-1 w-full overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-ink"
              style={{ width: `${(elapsed * 100).toFixed(2)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between gap-4 text-xs leading-5 text-ink-3">
            <span>
              {PLAN_COPY.started}{" "}
              <LocalDate iso={profile.trial_started_at} format="day-month" />
            </span>
            <span>
              {active ? PLAN_COPY.ends : PLAN_COPY.endedOn}{" "}
              <LocalDate iso={ends} format="day-month" />
            </span>
          </div>
        </section>

        <section aria-labelledby="plan-included" className="mt-10">
          <h2
            id="plan-included"
            className="pb-2 text-sm leading-5 font-medium text-ink"
          >
            {PLAN_COPY.includedTitle}
          </h2>
          <ul className="border-t border-line">
            {PLAN_COPY.included.map((item) => (
              <li
                key={item.label}
                className="flex min-h-10 items-center gap-3 border-b border-line text-sm leading-5 text-ink"
              >
                <Icon
                  name={item.icon}
                  size={16}
                  className="shrink-0 text-ink-2"
                />
                {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-4 text-ink-3">{PLAN_COPY.foot}</p>
        </section>
      </div>
    </>
  );
}
