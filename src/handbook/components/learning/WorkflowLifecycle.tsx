import type { WorkflowLifecycleStep } from "@/handbook/lib/learning-catalog";
import { cn } from "@/lib/utils";

type Props = {
  steps: WorkflowLifecycleStep[];
  className?: string;
  /** Horizontal stepper for overview bands */
  variant?: "vertical" | "compact";
};

function StageTitleStack({ label, who }: { label: string; who: string }) {
  return (
    <div className="min-w-0 flex flex-col gap-0.5">
      <span className="text-sm font-medium leading-tight text-foreground">{label}</span>
      <span className="text-xs font-medium leading-snug text-primary">{who}</span>
    </div>
  );
}

function StageDetailTitle({ label, who }: { label: string; who: string }) {
  return (
    <p className="text-sm font-semibold leading-snug text-foreground">
      {label}
      <span className="font-normal text-muted-foreground/80" aria-hidden> : </span>
      <span className="font-medium text-primary">{who}</span>
    </p>
  );
}

export function WorkflowLifecycle({ steps, className, variant = "vertical" }: Props) {
  if (variant === "compact") {
    return (
      <ol
        className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", className)}
        aria-label="Workflow lifecycle overview"
      >
        {steps.map((step, i) => (
          <li
            key={i}
            className="flex h-full min-h-[4.25rem] min-w-0 items-start gap-2 rounded-lg border border-border/60 bg-card/80 px-3 py-2.5"
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <StageTitleStack label={step.label} who={step.who} />
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className={cn("m-0 list-none p-0", className)} aria-label="Workflow lifecycle">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={i} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3">
            <div className="flex flex-col items-center">
              <span
                className="relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                aria-hidden
              >
                {i + 1}
              </span>
              {!isLast ? <div className="mt-1 w-0.5 min-h-[1rem] flex-1 bg-primary/25" aria-hidden /> : null}
            </div>
            <div className={cn("min-w-0 pb-4", isLast && "pb-0")}>
              <StageDetailTitle label={step.label} who={step.who} />
              {step.what ? (
                <p className="mt-1 text-sm leading-snug text-muted-foreground">{step.what}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
