import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Code2,
  FileEdit,
  Upload,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  accordionChevron,
  accordionPanelMotion,
  motionClass,
  surfaceCard,
  taskCardButton,
  taskCardChevron,
} from "@/components/design/tokens";
import {
  compactSlaLabel,
  sortDocTasks,
  TASK_SORT_OPTIONS,
  type SortableDocTask,
  type TaskSortOption,
  type WorkflowStage,
} from "@/lib/my-tasks-sort";
import { dashboardTaskUrgencySurface, taskCardUrgencyClass, type SlaUrgency } from "@/lib/sla-urgency";
import type { DocumentationWorkflowTask } from "@/components/documentation-verification-task-row";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TaskSortSelect({
  value,
  onChange,
  className,
}: {
  value: TaskSortOption;
  onChange: (value: TaskSortOption) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label htmlFor="task-sort" className="text-xs text-muted-foreground shrink-0">Sort by</Label>
      <Select value={value} onValueChange={(v) => onChange(v as TaskSortOption)}>
        <SelectTrigger id="task-sort" className="h-8 w-[11.5rem] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TASK_SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export type DocGroupConfig = {
  stage: WorkflowStage;
  label: string;
  icon: LucideIcon;
  defaultCollapsed?: boolean;
};

export const PRODUCT_GUIDE_TASK_GROUPS: DocGroupConfig[] = [
  { stage: "draft", label: "Draft", icon: FileEdit, defaultCollapsed: true },
  { stage: "verification_required", label: "Verification Required", icon: ClipboardCheck },
  { stage: "ready_to_publish", label: "Ready to Publish", icon: Upload },
];

export const INTEGRATION_DOC_TASK_GROUPS: DocGroupConfig[] = PRODUCT_GUIDE_TASK_GROUPS;

export function WorkflowTaskColumn({
  group,
  count,
  collapsed,
  onToggle,
  children,
}: {
  group: DocGroupConfig;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const Icon = group.icon;
  return (
    <div className={cn(surfaceCard, "flex min-h-0 flex-col self-start overflow-hidden p-0")}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between gap-2 border-b border-border/70 px-3 py-3 text-left",
          motionClass,
          "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
        aria-expanded={!collapsed}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-3.5" aria-hidden />
          </span>
          <span className="truncate text-[11px] font-semibold tracking-wide text-foreground uppercase">
            {group.label}
            <span className="font-normal text-muted-foreground"> ({count})</span>
          </span>
        </span>
        <ChevronDown className={cn("size-4", accordionChevron, collapsed && "-rotate-90")} />
      </button>
      <div className={cn(accordionPanelMotion, collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}>
        <div className="min-h-0 overflow-hidden">
          <ul className="flex flex-col gap-1.5 p-2">{children}</ul>
        </div>
      </div>
    </div>
  );
}

function DocumentationTaskCard({
  task,
  onOpen,
  slaUrgency,
}: {
  task: DocumentationWorkflowTask;
  onOpen: () => void;
  slaUrgency?: SlaUrgency;
}) {
  const overdue = task.slaState === "Overdue";
  const sla = compactSlaLabel(task);
  const category = (task.subtitle || "").trim();
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(taskCardButton, taskCardUrgencyClass(slaUrgency), dashboardTaskUrgencySurface(slaUrgency))}
      >
        <span className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-foreground">{task.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {category ? `${category} · ` : ""}
            <span className={overdue ? "font-medium text-red-700 dark:text-red-300" : undefined}>{sla}</span>
          </p>
        </span>
        <ChevronRight className={taskCardChevron} aria-hidden />
      </button>
    </li>
  );
}

export type DashboardModuleTaskRow = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  slaLabel: string;
  slaUrgency: SlaUrgency;
  overdue?: boolean;
};

export function GenericModuleTaskCard({
  task,
  onOpen,
}: {
  task: DashboardModuleTaskRow;
  onOpen: () => void;
}) {
  const overdue = task.overdue ?? task.slaUrgency === "overdue";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          taskCardButton,
          taskCardUrgencyClass(task.slaUrgency),
          dashboardTaskUrgencySurface(task.slaUrgency),
        )}
      >
        <span className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-foreground">{task.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {task.subtitle ? `${task.subtitle} · ` : ""}
            <span className={overdue ? "font-medium text-red-700 dark:text-red-300" : undefined}>{task.slaLabel}</span>
          </p>
        </span>
        <ChevronRight className={taskCardChevron} aria-hidden />
      </button>
    </li>
  );
}

export function DocumentationTaskList({
  tasks,
  sortBy,
  groups,
  onOpenTask,
  taskUrgency,
  stageCounts,
}: {
  tasks: SortableDocTask[];
  sortBy: TaskSortOption;
  groups: DocGroupConfig[];
  onOpenTask: (task: SortableDocTask) => void;
  taskUrgency?: (task: SortableDocTask) => SlaUrgency | undefined;
  stageCounts?: Record<string, number>;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.stage, g.defaultCollapsed ?? false])),
  );

  const columns = groups
    .map((group) => ({
      group,
      items: sortDocTasks(tasks.filter((t) => t.stage === group.stage), sortBy),
    }))
    .filter((col) => col.items.length > 0);

  if (!columns.length) return null;

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {columns.map(({ group, items }) => {
        const shut = collapsed[group.stage] ?? group.defaultCollapsed ?? false;
        return (
          <WorkflowTaskColumn
            key={group.stage}
            group={group}
            count={stageCounts?.[group.stage] ?? items.length}
            collapsed={shut}
            onToggle={() => setCollapsed((c) => ({ ...c, [group.stage]: !shut }))}
          >
            {items.map((task) => (
              <DocumentationTaskCard
                key={`${task.kind}-${task.recordId}`}
                task={task}
                onOpen={() => onOpenTask(task)}
                slaUrgency={taskUrgency?.(task)}
              />
            ))}
          </WorkflowTaskColumn>
        );
      })}
    </div>
  );
}

export type IntegrationTaskItem = {
  id: string;
  stage: WorkflowStage;
  title: string;
  category: string;
  slaLabel: string;
  overdue: boolean;
  stageTimestamp: number;
  msToDeadline: number | null;
  onOpen: () => void;
};

export function integrationSlaMeta(
  slaDeadline: string | null | undefined,
  slaTimer: string | null | undefined,
  slaState: string | null | undefined,
  isDraft: boolean,
  now = Date.now(),
): { label: string; overdue: boolean; msToDeadline: number | null } {
  if (isDraft) return { label: "Draft", overdue: false, msToDeadline: null };
  if (slaTimer) {
    const overdue = slaTimer.startsWith("Overdue") || slaState === "Overdue";
    let label = slaTimer;
    if (slaTimer.endsWith(" remaining")) label = `Due in ${slaTimer.replace(" remaining", "")}`;
    return {
      label,
      overdue,
      msToDeadline: slaDeadline ? new Date(slaDeadline).getTime() - now : null,
    };
  }
  if (slaState === "Overdue") return { label: "Overdue", overdue: true, msToDeadline: -1 };
  return { label: "—", overdue: false, msToDeadline: null };
}

function compareSlaKeys(
  aMs: number | null,
  bMs: number | null,
  aTs: number,
  bTs: number,
  aId: string,
  bId: string,
  sort: TaskSortOption,
): number {
  if (sort === "oldest") return aTs - bTs || aId.localeCompare(bId);
  if (sort === "newest") return bTs - aTs || bId.localeCompare(aId);
  const aHas = aMs !== null;
  const bHas = bMs !== null;
  if (sort === "closest_sla") {
    if (aHas && bHas) return aMs! - bMs!;
    if (aHas) return -1;
    if (bHas) return 1;
    return aTs - bTs || aId.localeCompare(bId);
  }
  if (aHas && bHas) {
    const aOver = aMs! < 0;
    const bOver = bMs! < 0;
    if (!aOver && !bOver) return bMs! - aMs!;
    if (aOver && bOver) return bMs! - aMs!;
    if (!aOver && bOver) return -1;
    return 1;
  }
  if (!aHas && !bHas) return bTs - aTs || bId.localeCompare(aId);
  if (aHas) return -1;
  return 1;
}

export function compareIntegrationTasks(a: IntegrationTaskItem, b: IntegrationTaskItem, sort: TaskSortOption): number {
  return compareSlaKeys(a.msToDeadline, b.msToDeadline, a.stageTimestamp, b.stageTimestamp, a.id, b.id, sort);
}

export function sortIntegrationTasks(items: IntegrationTaskItem[], sort: TaskSortOption): IntegrationTaskItem[] {
  return [...items].sort((a, b) => compareIntegrationTasks(a, b, sort));
}

export const INTEGRATION_OTHER_GROUPS: DocGroupConfig[] = [
  { stage: "frontend_work", label: "Frontend Work", icon: Code2 },
  { stage: "pending_review", label: "Pending Review", icon: UserCheck },
];

function IntegrationTaskCard({ item, slaUrgency }: { item: IntegrationTaskItem; slaUrgency?: SlaUrgency }) {
  return (
    <li>
      <button
        type="button"
        onClick={item.onOpen}
        className={cn(
          taskCardButton,
          taskCardUrgencyClass(slaUrgency ?? (item.overdue ? "overdue" : "neutral")),
          dashboardTaskUrgencySurface(slaUrgency ?? (item.overdue ? "overdue" : "neutral")),
        )}
      >
        <span className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-foreground">{item.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {item.category ? `${item.category} · ` : ""}
            <span className={item.overdue ? "font-medium text-red-700 dark:text-red-300" : undefined}>
              {item.slaLabel}
            </span>
          </p>
        </span>
        <ChevronRight className={taskCardChevron} aria-hidden />
      </button>
    </li>
  );
}

export function IntegrationTaskList({
  items,
  sortBy,
  docGroups,
  taskUrgency,
  stageCounts,
  otherGroups,
}: {
  items: IntegrationTaskItem[];
  sortBy: TaskSortOption;
  docGroups: DocGroupConfig[];
  otherGroups: DocGroupConfig[];
  taskUrgency?: (item: IntegrationTaskItem) => SlaUrgency | undefined;
  stageCounts?: Record<string, number>;
}) {
  const allGroups = [...docGroups, ...otherGroups];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(allGroups.map((g) => [g.stage, g.defaultCollapsed ?? false])),
  );

  if (!items.length) return null;

  const columns = allGroups
    .map((group) => ({
      group,
      items: sortIntegrationTasks(items.filter((i) => i.stage === group.stage), sortBy),
    }))
    .filter((col) => col.items.length > 0);

  if (!columns.length) return null;

  const gridClass =
    columns.length > 3
      ? "grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
      : "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={cn("grid items-start", gridClass)}>
      {columns.map(({ group, items: groupItems }) => {
        const shut = collapsed[group.stage] ?? group.defaultCollapsed ?? false;
        return (
          <WorkflowTaskColumn
            key={group.stage}
            group={group}
            count={stageCounts?.[group.stage] ?? groupItems.length}
            collapsed={shut}
            onToggle={() => setCollapsed((c) => ({ ...c, [group.stage]: !shut }))}
          >
            {groupItems.map((item) => (
              <IntegrationTaskCard key={item.id} item={item} slaUrgency={taskUrgency?.(item)} />
            ))}
          </WorkflowTaskColumn>
        );
      })}
    </div>
  );
}
