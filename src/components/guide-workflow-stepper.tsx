import { workflowStagesForStatus, type WorkflowStageKey } from "@/lib/guide-workflow";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STAGES: { key: WorkflowStageKey; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "readyToPublish", label: "Ready to Publish" },
  { key: "published", label: "Published" },
];

function stageClass(state: string) {
  if (state === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  if (state === "action") return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100";
  if (state === "active") return "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100";
  return "border-border bg-muted/40 text-muted-foreground";
}

export function GuideWorkflowStepper({ status, compact }: { status: string; compact?: boolean }) {
  const stages = workflowStagesForStatus(status);
  const isChangesRequired = status === "Changes Required";

  return (
    <div className="space-y-2">
      {isChangesRequired ? (
        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
          Changes Required — update content, then mark ready to publish.
        </p>
      ) : null}
      <div
        className={cn("flex flex-wrap items-center gap-1.5", compact ? "text-[10px]" : "text-xs")}
        aria-label="Guide workflow: Draft, Ready to Publish, Published"
      >
        {STAGES.map((stage, index) => {
          const state = stages[stage.key];
          return (
            <div key={stage.key} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
                  stageClass(state),
                )}
              >
                {state === "complete" ? <Check className="size-3 shrink-0" aria-hidden /> : null}
                <span className={state === "active" || state === "action" ? "font-semibold" : ""}>{stage.label}</span>
              </span>
              {index < STAGES.length - 1 ? <span className="text-muted-foreground" aria-hidden>→</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
