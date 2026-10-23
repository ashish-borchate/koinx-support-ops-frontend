import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  Flag,
  Gauge,
  GraduationCap,
  Files,
  MessageSquarePlus,
  Plug,
  ThumbsDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { accordionChevron, dashboardModuleShell, motionClass } from "@/components/design/tokens";
import type { SlaUrgency } from "@/lib/sla-urgency";
import type { DocumentationWorkflowTask } from "@/components/documentation-verification-task-row";
import {
  DocumentationTaskList,
  GenericModuleTaskCard,
  INTEGRATION_DOC_TASK_GROUPS,
  INTEGRATION_OTHER_GROUPS,
  IntegrationTaskList,
  PRODUCT_GUIDE_TASK_GROUPS,
  type DocGroupConfig,
  type IntegrationTaskItem,
  WorkflowTaskColumn,
} from "@/components/my-tasks-workspace";
import type { WorkflowStage } from "@/lib/my-tasks-sort";

export type DashboardModuleTask = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  stage: string;
  slaLabel: string;
  slaUrgency: SlaUrgency;
  slaDeadline: string | null;
  requiredAt: string | null;
  msToDeadline: number | null;
};

export type DashboardModuleStage = {
  stage: string;
  label: string;
  count: number;
  overdueInStage?: number;
  tasks: DashboardModuleTask[];
};

export type DashboardModuleGroup = {
  moduleId: string;
  moduleName: string;
  total: number;
  overdueCount: number;
  viewAllHref: string;
  stages: DashboardModuleStage[];
};

const MODULE_ICONS: Record<string, LucideIcon> = {
  product_guides: BookOpen,
  integration_steps: Plug,
  supported_files: Files,
  token_migration: Gauge,
  product_feedback: MessageSquarePlus,
  coaching: GraduationCap,
  reported_issues: Flag,
  negative_reviews: ThumbsDown,
  kpi_performance: Gauge,
  quality_assurance: ClipboardCheck,
};

const PG_EXTRA_GROUPS: DocGroupConfig[] = [
  { stage: "periodic_review" as WorkflowStage, label: "Accuracy review", icon: CalendarClock },
  { stage: "daily_review" as WorkflowStage, label: "Daily review", icon: CalendarClock },
];

const DOC_STAGES = new Set(["draft", "verification_required", "ready_to_publish"]);

function dashboardTaskToDoc(task: DashboardModuleTask, moduleId: string): DocumentationWorkflowTask {
  const recordId = task.href.split("/").pop()?.split("?")[0] || task.id;
  const kind =
    task.stage === "draft"
      ? "documentation_preparation"
      : task.stage === "verification_required"
        ? "documentation_verification"
        : "documentation_publication";
  return {
    kind,
    stage: task.stage as DocumentationWorkflowTask["stage"],
    title: task.title,
    actionLabel: task.subtitle || "Task",
    module: moduleId === "integration_steps" ? "Integration Steps" : "Product Guides",
    recordId,
    subtitle: task.subtitle,
    requiredAt: task.requiredAt,
    slaDeadline: task.slaDeadline,
    slaState: task.slaUrgency === "overdue" ? "Overdue" : task.slaDeadline ? "Pending" : null,
    slaTimer: task.slaLabel === "Draft" || task.slaLabel === "—" ? null : task.slaLabel,
  };
}

function dashboardTaskToIntegration(task: DashboardModuleTask, navigate: (href: string) => void): IntegrationTaskItem {
  const id = task.href.split("/").pop()?.split("?")[0] || task.id;
  return {
    id,
    stage: task.stage as WorkflowStage,
    title: task.title,
    category: task.subtitle,
    slaLabel: task.slaLabel,
    overdue: task.slaUrgency === "overdue",
    stageTimestamp: task.requiredAt ? new Date(task.requiredAt).getTime() : 0,
    msToDeadline: task.msToDeadline,
    onOpen: () => navigate(task.href),
  };
}

function GenericStageGrid({
  stages,
  groupConfigs,
  navigate,
}: {
  stages: DashboardModuleStage[];
  groupConfigs: DocGroupConfig[];
  navigate: (href: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groupConfigs.map((g) => [g.stage, g.defaultCollapsed ?? false])),
  );
  const configByStage = new Map(groupConfigs.map((g) => [g.stage, g]));

  const columns = stages
    .map((stage) => {
      const group = configByStage.get(stage.stage as WorkflowStage);
      if (!group) return null;
      return { group, stage };
    })
    .filter((col): col is { group: DocGroupConfig; stage: DashboardModuleStage } => Boolean(col));

  if (!columns.length) return null;

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {columns.map(({ group, stage }) => {
        const shut = collapsed[group.stage] ?? group.defaultCollapsed ?? false;
        return (
          <WorkflowTaskColumn
            key={stage.stage}
            group={group}
            count={stage.count}
            collapsed={shut}
            onToggle={() => setCollapsed((c) => ({ ...c, [group.stage]: !shut }))}
          >
            {stage.tasks.map((task) => (
              <GenericModuleTaskCard
                key={task.id}
                task={{
                  id: task.id,
                  title: task.title,
                  subtitle: task.subtitle,
                  href: task.href,
                  slaLabel: task.slaLabel,
                  slaUrgency: task.slaUrgency,
                }}
                onOpen={() => navigate(task.href)}
              />
            ))}
          </WorkflowTaskColumn>
        );
      })}
    </div>
  );
}

function ModuleCard({ group, defaultExpanded }: { group: DashboardModuleGroup; defaultExpanded: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(defaultExpanded);
  const Icon = MODULE_ICONS[group.moduleId] || BookOpen;

  const docStages = group.stages.filter((s) => DOC_STAGES.has(s.stage));
  const otherStages = group.stages.filter((s) => !DOC_STAGES.has(s.stage));

  const docTasks = docStages.flatMap((s) => s.tasks.map((t) => dashboardTaskToDoc(t, group.moduleId)));

  const integrationOther = INTEGRATION_OTHER_GROUPS;

  const stageCounts = useMemo(
    () => Object.fromEntries(group.stages.map((s) => [s.stage, s.count])),
    [group.stages],
  );

  const genericConfigs: DocGroupConfig[] = otherStages.map((s) => ({
    stage: s.stage as WorkflowStage,
    label: s.label,
    icon: MODULE_ICONS[group.moduleId] || BookOpen,
  }));

  const showViewAll = group.stages.some((s) => s.count > s.tasks.length);

  return (
    <div className={dashboardModuleShell}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5 text-left",
          motionClass,
          "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="text-sm font-semibold text-foreground">{group.moduleName}</span>
            <span className="ml-2 text-sm font-normal text-muted-foreground">({group.total} pending)</span>
            {group.overdueCount > 0 ? (
              <span className="mt-0.5 block text-xs font-medium text-red-700 dark:text-red-300">
                {group.overdueCount} overdue
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDown className={cn("size-5", accordionChevron, !open && "-rotate-90")} />
      </button>
      {open ? (
        <div className="space-y-4 bg-muted/[0.12] p-4 dark:bg-muted/5">
          {group.moduleId === "product_guides" && docTasks.length > 0 ? (
            <DocumentationTaskList
              tasks={docTasks}
              sortBy="closest_sla"
              groups={PRODUCT_GUIDE_TASK_GROUPS}
              onOpenTask={(task) => navigate(`/product-guides/${task.recordId}`)}
              stageCounts={stageCounts}
              taskUrgency={(task) => {
                const found = group.stages
                  .flatMap((s) => s.tasks)
                  .find((t) => DOC_STAGES.has(t.stage) && t.href.includes(task.recordId));
                return found?.slaUrgency ?? (task.slaState === "Overdue" ? "overdue" : undefined);
              }}
            />
          ) : null}
          {group.moduleId === "product_guides" && otherStages.length > 0 ? (
            <GenericStageGrid stages={otherStages} groupConfigs={PG_EXTRA_GROUPS} navigate={navigate} />
          ) : null}
          {group.moduleId === "integration_steps" ? (
            <IntegrationTaskList
              items={group.stages.flatMap((s) => s.tasks.map((t) => dashboardTaskToIntegration(t, navigate)))}
              sortBy="closest_sla"
              docGroups={INTEGRATION_DOC_TASK_GROUPS}
              otherGroups={integrationOther}
              stageCounts={stageCounts}
              taskUrgency={(item) => {
                const match = group.stages
                  .flatMap((s) => s.tasks)
                  .find((t) => t.href.includes(item.id));
                return match?.slaUrgency;
              }}
            />
          ) : null}
          {group.moduleId !== "product_guides" && group.moduleId !== "integration_steps" ? (
            <GenericStageGrid stages={group.stages} groupConfigs={genericConfigs} navigate={navigate} />
          ) : null}
          {showViewAll ? (
            <Link to={group.viewAllHref} className="text-xs font-medium text-primary hover:underline">
              View all in {group.moduleName}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ModuleTasksBoard({ groups, total }: { groups: DashboardModuleGroup[]; total: number }) {
  const urgentModuleId = useMemo(() => {
    let best: { id: string; score: number } | null = null;
    for (const g of groups) {
      const score = g.overdueCount * 1000 + g.total;
      if (!best || score > best.score) best = { id: g.moduleId, score };
    }
    return best?.id;
  }, [groups]);

  if (!groups.length || total === 0) return null;

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <ModuleCard key={group.moduleId} group={group} defaultExpanded={group.moduleId === urgentModuleId} />
      ))}
    </div>
  );
}
