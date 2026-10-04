import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttentionList } from "@/components/design/attention-list";
import { MetricCard } from "@/components/design/metric-card";
import { PageHeader, SectionHeader } from "@/components/design/page-header";
import { Empty, ErrorBlock, LoadingBlock } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STALE } from "@/lib/query-client";
import { OperationsWorkspace, type WorkspacePayload } from "@/components/operations-workspace";
import { LatestSupportUpdatesSection, type SupportUpdateItem } from "@/components/support-updates-feed";
import { formatNumber, type Metric } from "@/lib/format";

type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  sourceModule?: string;
  actionLabel?: string;
  priority?: string;
};
type Dash = {
  roleName: string;
  attentionItems: AttentionItem[];
  workspace?: WorkspacePayload | null;
  productGuideStats?: Record<string, number> | null;
  featureImpactSummary?: { total: number; complete: number; active: number } | null;
  integrationStats?: Record<string, number> | null;
  productFeedbackStats?:
    | { audience: "reviewer"; pending: number; dueSoon: number; overdue: number }
    | { audience: "submitter"; submitted: number; pendingReview: number; approved: number; rejected: number }
    | null;
  team: { active: number; inactive: number; byRole: Record<string, number> } | null;
  weekly: {
    label: string;
    partial: boolean;
    ticketHealth: {
      received: Metric;
      resolved: Metric;
      backlog: Metric;
      sla: Metric;
      csat: Metric;
    };
    operations: { tasksCompleted: number; tasksOpen: number };
    product: { openEscalations: number };
  } | null;
  ownKpi: {
    label: string;
    ticketsHandled: Metric;
    csatPercent: Metric;
    slaPercent: Metric;
    firstResponseHours: Metric;
  } | null;
  tasks: { id: string; title: string; status: string; dueDate: string; owner?: string }[];
  escalations: { id: string; title: string; priority: string; status: string }[];
  announcements: { id: string; title: string; body: string }[];
  latestSupportUpdates?: SupportUpdateItem[];
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  senior_agent: "Senior Agent",
  agent: "Agent",
  tech_agent: "Tech Agent",
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
      <PageHeader eyebrow="Overview" title={`${data.roleName} dashboard`} description="Your queue, metrics, and operational snapshot." />

      <section>
        <SectionHeader title="Needs your attention" />
        {data.attentionItems.length === 0 ? (
          <Empty title="You're all caught up." body="Nothing assigned to you is waiting right now." />
        ) : (
          <AttentionList items={data.attentionItems} />
        )}
      </section>

      {can("support_updates.view") && data.latestSupportUpdates ? (
        <LatestSupportUpdatesSection items={data.latestSupportUpdates} />
      ) : null}

      {data.team ? (
        <section>
          <SectionHeader title="People" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Active people" value={String(data.team.active)} />
            <Stat label="Inactive" value={String(data.team.inactive)} />
            {Object.entries(data.team.byRole).map(([key, count]) => (
              <Stat key={key} label={ROLE_LABEL[key] || key} value={String(count)} />
            ))}
          </div>
        </section>
      ) : null}

      {data.weekly ? (
        <section>
          <SectionHeader title={`Team snapshot · ${data.weekly.label}`} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Tickets received" value={metricText(data.weekly.ticketHealth.received)} />
            <Stat label="Resolved" value={metricText(data.weekly.ticketHealth.resolved)} />
            <Stat label="Open backlog" value={metricText(data.weekly.ticketHealth.backlog)} />
            <Stat label="SLA" value={metricText(data.weekly.ticketHealth.sla, "%")} />
            <Stat label="CSAT" value={metricText(data.weekly.ticketHealth.csat, "%")} />
            <Stat label="Open escalations" value={String(data.weekly.product.openEscalations)} />
            <Stat label="Open tasks" value={String(data.weekly.operations.tasksOpen)} />
          </div>
          {data.weekly.partial ? <p className="mt-2 text-xs text-slate-500">This week is still in progress.</p> : null}
        </section>
      ) : null}

      {data.ownKpi ? (
        <section>
          <SectionHeader title={`Your week · ${data.ownKpi.label}`} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Tickets" value={metricText(data.ownKpi.ticketsHandled, "", 0)} />
            <Stat label="CSAT" value={metricText(data.ownKpi.csatPercent, "%")} />
            <Stat label="SLA" value={metricText(data.ownKpi.slaPercent, "%")} />
            <Stat label="First response" value={metricText(data.ownKpi.firstResponseHours, "h")} />
          </div>
        </section>
      ) : null}

      {data.productGuideStats && can("guides.view") ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Product guides</h2>
            <Link to="/product-guides" className="text-xs text-blue-700">Open library</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total" value={String(data.productGuideStats.total ?? 0)} />
            <Stat label="Published" value={String(data.productGuideStats.Published ?? 0)} />
            <Stat label="Pending review" value={String(data.productGuideStats["Pending Review"] ?? 0)} />
            <Stat label="Ready to publish" value={String(data.productGuideStats["Approved — Ready to Publish"] ?? 0)} />
            <Stat label="Changes required" value={String(data.productGuideStats["Changes Required"] ?? 0)} />
            <Stat label="Review due" value={String(data.productGuideStats.reviewDue ?? 0)} />
          </div>
        </section>
      ) : null}

      {data.featureImpactSummary && can("feature_impact.view", "guides.manage") ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Feature impacts</h2>
            <Link to="/feature-impacts" className="text-xs text-blue-700">View tracker</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Active" value={String(data.featureImpactSummary.active)} />
            <Stat label="Complete" value={String(data.featureImpactSummary.complete)} />
            <Stat label="Total" value={String(data.featureImpactSummary.total)} />
          </div>
        </section>
      ) : null}

      {data.integrationStats && can("integration.dashboard") ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Integration Steps</h2>
            <Link to="/integration-steps/dashboard" className="text-xs text-blue-700">Open module</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total" value={String(data.integrationStats.total ?? 0)} />
            <Stat label="Pending review" value={String(data.integrationStats.pendingReview ?? 0)} />
            <Stat label="Pending approval" value={String(data.integrationStats.pendingApproval ?? 0)} />
            <Stat label="Overdue SLAs" value={String(data.integrationStats.overdue ?? 0)} />
          </div>
        </section>
      ) : null}

      {data.productFeedbackStats && can("feedback.view") ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Product feedback</h2>
            <Link to="/product-feedback/tracker" className="text-xs text-blue-700">
              Open tracker
            </Link>
          </div>
          {data.productFeedbackStats.audience === "reviewer" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Link to="/product-feedback/tracker?review=Pending+Review">
                <Stat label="Pending reviews" value={String(data.productFeedbackStats.pending)} />
              </Link>
              <Link to="/product-feedback/tracker?sla=due-soon&review=Pending+Review">
                <Stat label="Reviews due soon" value={String(data.productFeedbackStats.dueSoon)} />
              </Link>
              <Link to="/product-feedback/tracker?sla=overdue&review=Pending+Review">
                <Stat label="Reviews overdue" value={String(data.productFeedbackStats.overdue)} />
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Submitted" value={String(data.productFeedbackStats.submitted)} />
              <Stat label="Pending review" value={String(data.productFeedbackStats.pendingReview)} />
              <Stat label="Approved" value={String(data.productFeedbackStats.approved)} />
              <Stat label="Rejected" value={String(data.productFeedbackStats.rejected)} />
            </div>
          )}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {can("tasks.view_own", "tasks.view_team") ? (
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.tasks.length === 0 ? <p className="text-muted-foreground">No open tasks in this view.</p> : null}
              {data.tasks.map((task) => (
                <Link
                  key={task.id}
                  to="/tasks"
                  className="block rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 motion-safe:transition-colors hover:border-primary/20 hover:bg-muted/40"
                >
                  <p className="font-medium text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.status}
                    {task.dueDate ? ` · due ${task.dueDate}` : ""}
                    {task.owner ? ` · ${task.owner}` : ""}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : null}
        {can("escalations.view_own", "escalations.view_team") ? (
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle>Escalations</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.escalations.length === 0 ? <p className="text-muted-foreground">No open escalations in this view.</p> : null}
              {data.escalations.map((item) => (
                <Link
                  key={item.id}
                  to="/escalations"
                  className="block rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 motion-safe:transition-colors hover:border-primary/20 hover:bg-muted/40"
                >
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.priority} · {item.status}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {data.announcements.length ? (
        <section className="space-y-2">
          <SectionHeader title="Announcements" />
          {data.announcements.map((item) => (
            <article key={item.id} className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-[var(--shadow-card)]">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </section>
      ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <MetricCard label={label} value={value} interactive />;
}

function metricText(metric: Metric | undefined, suffix = "", digits = 1) {
  if (!metric || metric.value == null) return "—";
  return `${formatNumber(metric.value, digits)}${suffix}`;
}
