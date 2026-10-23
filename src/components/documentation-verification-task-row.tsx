import { cn } from "@/lib/utils";
import { formatWhen } from "@/lib/format";

export type DocumentationWorkflowTask = {
  kind: "documentation_preparation" | "documentation_verification" | "documentation_publication";
  stage: "draft" | "verification_required" | "ready_to_publish";
  title: string;
  actionLabel: string;
  module: "Integration Steps" | "Product Guides";
  recordId: string;
  subtitle?: string | null;
  requiredAt: string | null;
  slaDeadline: string | null;
  slaState: "Pending" | "Overdue" | null;
  slaTimer: string | null;
  legacyTiming?: boolean;
};

/** @deprecated Use DocumentationWorkflowTask */
export type DocumentationVerificationTask = DocumentationWorkflowTask;

function taskDetailLine(task: DocumentationWorkflowTask) {
  if (task.kind === "documentation_verification") {
    return `${task.actionLabel} · 24-hour SLA`;
  }
  if (task.kind === "documentation_publication") {
    return `${task.actionLabel} · publication SLA`;
  }
  return `${task.actionLabel} · No verification SLA`;
}

export function DocumentationVerificationTaskRow({
  task,
  onOpen,
  className,
}: {
  task: DocumentationWorkflowTask;
  onOpen: () => void;
  className?: string;
}) {
  const overdue = task.slaState === "Overdue";
  const hasSla = task.kind !== "documentation_preparation";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "block w-full px-4 py-3 text-left transition-colors hover:bg-muted/40 dark:hover:bg-muted/40",
        className,
      )}
    >
      <p className="font-medium text-primary">{task.title}</p>
      {task.subtitle ? <p className="text-xs text-muted-foreground">{task.subtitle}</p> : null}
      <p className="mt-1 text-sm text-muted-foreground">
        {taskDetailLine(task)}
        {hasSla && task.slaDeadline
          ? ` · Due ${formatWhen(task.slaDeadline)}`
          : task.legacyTiming
            ? " · SLA start not recorded"
            : ""}
      </p>
      {hasSla ? (
        <p className="mt-1 text-xs">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              overdue
                ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-100"
                : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
            )}
          >
            {overdue ? "Overdue" : "Pending"}
          </span>
          {task.slaTimer ? <span className="ml-2 text-muted-foreground">{task.slaTimer}</span> : null}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">Open · Draft preparation</p>
      )}
    </button>
  );
}
