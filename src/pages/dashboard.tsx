import { useQuery } from "@tanstack/react-query";
import { DashboardNeedsAttentionSection } from "@/components/dashboard-needs-attention-section";
import { SectionHeader } from "@/components/design/page-header";
import { DashboardGreetingHero } from "@/components/dashboard-greeting-hero";
import { ErrorBlock, LoadingBlock } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STALE } from "@/lib/query-client";
import { OperationsWorkspace, type WorkspacePayload } from "@/components/operations-workspace";
import { ModuleTasksBoard, type DashboardModuleGroup } from "@/components/module-tasks-board";
import { LatestSupportUpdatesSection, type SupportUpdateItem } from "@/components/support-updates-feed";
import { QaWorkflowSummaryCards } from "@/components/qa-workflow-summary-cards";
import { AgentWeekKpiStrip } from "@/components/agent-week-kpi-strip";
import type { Metric } from "@/lib/format";

type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  sourceModule?: string;
  actionLabel?: string;
  priority?: string;
  acknowledgeGuideId?: string;
  hubDismissKey?: string;
};
type Dash = {
  roleName: string;
  attentionItems: AttentionItem[];
  moduleTaskGroups?: DashboardModuleGroup[];
  moduleTaskTotal?: number;
  workspace?: WorkspacePayload | null;
  kpiGoals?: {
    firstResponseHours: number;
    averageResponseHours: number;
    resolutionHours: number;
    csatPercent: number;
    slaPercent: number;
    qaPercent: number;
  };
  ownKpi: {
    label: string;
    ticketsHandled: Metric;
    csatPercent: Metric;
    slaPercent: Metric;
    firstResponseHours: Metric;
    averageResponseHours: Metric;
    resolutionHours: Metric;
    qaScore: number | null;
  } | null;
  latestSupportUpdates?: SupportUpdateItem[];
  qaWorkflowSummary?: { key: string; label: string; count: number; href: string }[] | null;
};

export function DashboardPage() {
  const { effective, can } = useAuth();
  const query = useQuery({
    queryKey: ["dashboard", effective?.id],
    queryFn: () => api<Dash>("/api/dashboard"),
    staleTime: STALE.workspace,
    placeholderData: (prev) => prev,
  });

  if (query.isPending && !query.data) return <LoadingBlock />;
  if (query.isError) return <ErrorBlock message={query.error.message} />;
  const data = query.data;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {data.workspace ? (
        <OperationsWorkspace workspace={data.workspace} />
      ) : (
        <>
          {effective?.name ? <DashboardGreetingHero displayName={effective.name} /> : null}

          {data.ownKpi && data.kpiGoals ? (
            <section>
              <SectionHeader title={`Your week · ${data.ownKpi.label}`} />
              <AgentWeekKpiStrip ownKpi={data.ownKpi} goals={data.kpiGoals} />
            </section>
          ) : null}

          <DashboardNeedsAttentionSection items={data.attentionItems} />

          {(data.moduleTaskTotal ?? 0) > 0 && data.moduleTaskGroups ? (
            <section>
              <SectionHeader
                title="Your pending tasks"
                description="Track and manage your pending work across the Support Hub."
                action={
                  <span className="text-sm font-medium tabular-nums text-muted-foreground">{data.moduleTaskTotal} total</span>
                }
              />
              <ModuleTasksBoard groups={data.moduleTaskGroups} total={data.moduleTaskTotal ?? 0} />
            </section>
          ) : null}

          <QaWorkflowSummaryCards counters={data.qaWorkflowSummary} />

          {can("support_updates.view") && data.latestSupportUpdates && data.latestSupportUpdates.length > 0 ? (
            <LatestSupportUpdatesSection items={data.latestSupportUpdates} />
          ) : null}
        </>
      )}
    </div>
  );
}
