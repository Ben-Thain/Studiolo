import { Icon } from "./icons";
import { cn } from "@/lib/utils";

export type StepState = "done" | "current" | "upcoming";

export type Step = {
  label: string;
  state: StepState;
};

export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex items-center gap-3">
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center gap-3">
          {index > 0 ? <span className="h-px w-6 bg-line" /> : null}
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-full text-xs font-medium",
                step.state === "current" && "bg-ink text-bg",
                step.state === "done" && "bg-ink text-bg",
                step.state === "upcoming" && "border border-line text-ink-3",
              )}
            >
              {step.state === "done" ? (
                <Icon name="check" size={12} />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={cn(
                "text-sm",
                step.state === "upcoming"
                  ? "font-normal text-ink-3"
                  : "font-medium text-ink",
              )}
            >
              {step.label}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
