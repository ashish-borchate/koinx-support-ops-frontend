import type { DocumentationWorkflowTask } from "@/components/documentation-verification-task-row";

export type TaskSortOption = "closest_sla" | "farthest_sla" | "oldest" | "newest";

export const TASK_SORT_OPTIONS: { value: TaskSortOption; label: string }[] = [
  { value: "closest_sla", label: "Closest to SLA" },
  { value: "farthest_sla", label: "Farthest from SLA" },
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
];

export type WorkflowStage =
  | "draft"
  | "verification_required"
  | "ready_to_publish"
  | "frontend_work"
  | "pending_review";

export type SortableDocTask = DocumentationWorkflowTask;

export function taskStageTimestamp(task: SortableDocTask): number {
  const raw = task.requiredAt || task.slaDeadline;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function msToSlaDeadline(task: SortableDocTask, now = Date.now()): number | null {
  if (task.kind === "documentation_preparation" || task.stage === "draft") return null;
  if (!task.slaDeadline) return null;
  const t = new Date(task.slaDeadline).getTime();
  if (Number.isNaN(t)) return null;
  return t - now;
}

export function compareDocTasks(a: SortableDocTask, b: SortableDocTask, sort: TaskSortOption, now = Date.now()): number {
  if (sort === "oldest") return taskStageTimestamp(a) - taskStageTimestamp(b) || a.recordId.localeCompare(b.recordId);
  if (sort === "newest") return taskStageTimestamp(b) - taskStageTimestamp(a) || b.recordId.localeCompare(a.recordId);

  const aMs = msToSlaDeadline(a, now);
  const bMs = msToSlaDeadline(b, now);
  const aHas = aMs !== null;
  const bHas = bMs !== null;

  if (sort === "closest_sla") {
    if (aHas && bHas) return aMs! - bMs!;
    if (aHas) return -1;
    if (bHas) return 1;
    return taskStageTimestamp(a) - taskStageTimestamp(b) || a.recordId.localeCompare(b.recordId);
  }

  // farthest_sla
  if (aHas && bHas) {
    const aOver = aMs! < 0;
    const bOver = bMs! < 0;
    if (!aOver && !bOver) return bMs! - aMs!;
    if (aOver && bOver) return bMs! - aMs!;
    if (!aOver && bOver) return -1;
    return 1;
  }
  if (!aHas && !bHas) return taskStageTimestamp(b) - taskStageTimestamp(a) || b.recordId.localeCompare(a.recordId);
  if (aHas) return -1;
  return 1;
}

export function sortDocTasks(tasks: SortableDocTask[], sort: TaskSortOption): SortableDocTask[] {
  return [...tasks].sort((a, b) => compareDocTasks(a, b, sort));
}

export function compactSlaLabel(task: SortableDocTask): string {
  if (task.kind === "documentation_preparation" || task.stage === "draft") return "Draft";
  if (task.slaTimer) {
    if (task.slaTimer.startsWith("Overdue")) {
      return task.slaTimer.replace("Overdue by ", "Overdue by ");
    }
    if (task.slaTimer.endsWith(" remaining")) {
      return `Due in ${task.slaTimer.replace(" remaining", "")}`;
    }
    return task.slaTimer;
  }
  if (task.slaState === "Overdue") return "Overdue";
  return "—";
}

export function parseTaskRecordTitle(task: SortableDocTask): string {
  return task.title.replace(/^(Prepare documentation|Verify changes|Confirm Mintlify publication) — /, "");
}

/** Periodic accuracy review — due date as SLA proxy */
export function comparePeriodicReviews<
  T extends { dueDate: string; overdue: boolean; overdueDays: number; guideId: string },
>(a: T, b: T, sort: TaskSortOption): number {
  const aDue = new Date(a.dueDate).getTime();
  const bDue = new Date(b.dueDate).getTime();
  if (sort === "oldest") return aDue - bDue || a.guideId.localeCompare(b.guideId);
  if (sort === "newest") return bDue - aDue || b.guideId.localeCompare(a.guideId);
  if (sort === "closest_sla") {
    if (a.overdue && b.overdue) return b.overdueDays - a.overdueDays;
    if (a.overdue) return -1;
    if (b.overdue) return 1;
    return aDue - bDue;
  }
  // farthest_sla
  if (a.overdue && b.overdue) return a.overdueDays - b.overdueDays;
  if (!a.overdue && !b.overdue) return bDue - aDue;
  if (!a.overdue) return -1;
  return 1;
}
