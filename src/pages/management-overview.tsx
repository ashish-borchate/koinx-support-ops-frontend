import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { DataTableShell, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { ManagementCompareDialog } from "@/components/management/management-compare-dialog";
import {
  ManagementOperationalDetailsDialog,
} from "@/components/management/management-operational-details-dialog";
import {
  COMPLETED_WORK_CATEGORIES,
  liveModuleLabel,
  type DrillDownTarget,
  type ManagementDrillModule,
} from "@/components/management/management-drill-down.constants";
import {
  KpiPerformanceDeepLink,
  ScorecardBreakdownPanel,
} from "@/components/kpi/scorecard-breakdown-panel";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  formatMonth,
  formatNumber,
  formatWeek,
  lastCompletedWeekStart,
  monthKey,
  recentMonths,
  recentWeeks,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { STALE } from "@/lib/query-client";

type Scorecard = {
  compositeScore: number | null;
  compositeDisplay: string;
  metrics: {
    id: string;
    label: string;
    actualLabel: string;
    target: number | null;
    weight: number;
    points: number | null;
    pointsDisplay: string;
  }[];
};

type OverviewPayload = {
  period: {
    type: "weekly" | "monthly";
    key: string;
    label: string;
    partial: boolean;
    previousLabel: string;
  };
  team: { scorecard: Scorecard | null; delta: { overall: number | null; metrics: Record<string, number> } };
  agents: {
    id: string;
    name: string;
    scorecard: Scorecard | null;
    hasKpiRow: boolean;
    qaReviewCount: number;
    delta: { overall: number | null };
  }[];
  completed: Record<string, Record<string, number | string | undefined>>;
  live: Record<string, { categoryKey: string; label: string; count: number; href?: string; tone?: string }[]>;
};

function deltaText(value: number | null, suffix = " pts") {
  if (value == null || value === 0) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1)}${suffix}`;
}

function MetricCard({
  title,
  value,
  target,
  earned,
  delta,
  prominent,
}: {
  title: string;
  value: string;
  target: string;
  earned?: string;
  delta?: string | null;
  prominent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]",
        prominent ? "border-primary/30 ring-1 ring-primary/10" : "border-border/60",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className={cn("mt-1 font-semibold tabular-nums text-foreground", prominent ? "text-2xl" : "text-xl")}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{target}</p>
      {earned ? <p className="mt-0.5 text-xs text-muted-foreground">{earned}</p> : null}
      {delta ? <p className="mt-1 text-xs font-medium text-muted-foreground">vs prior period: {delta}</p> : null}
    </div>
  );
}

function WorkstreamBlock({
  title,
  rows,
  period,
  liveBadge,
  onMetricClick,
}: {
  title: string;
  rows: { categoryKey: string; label: string; count: number; tone?: string }[];
  period?: boolean;
  liveBadge?: boolean;
  onMetricClick?: (categoryKey: string, count: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
        {title}
        {liveBadge ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
            Live
          </span>
        ) : null}
      </p>
      {period ? <p className="text-xs text-muted-foreground">Counts for selected reporting period</p> : null}
      <ul className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <li key={row.categoryKey} className="flex items-center justify-between gap-2 text-sm">
            {onMetricClick ? (
              <button
                type="button"
                className="text-left text-primary hover:underline"
                onClick={() => onMetricClick(row.categoryKey, row.count)}
              >
                {row.label}
              </button>
            ) : (
              <span className="text-muted-foreground">{row.label}</span>
            )}
            <span
              className={cn(
                "font-semibold tabular-nums",
                row.tone === "warning" ? "text-amber-700 dark:text-amber-300" : "text-foreground",
              )}
            >
              {row.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ManagementOverviewPage() {
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [week, setWeek] = useState(() => lastCompletedWeekStart());
  const [month, setMonth] = useState(() => monthKey());
  const [agentFilter, setAgentFilter] = useState("all");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillScope, setDrillScope] = useState<"live" | "completed">("live");
  const [drillTarget, setDrillTarget] = useState<DrillDownTarget | null>(null);

  const openDrillDown = (scope: "live" | "completed", module: ManagementDrillModule, category: string) => {
    setDrillScope(scope);
    setDrillTarget({ scope, module, category });
    setDrillOpen(true);
  };

  const queryKey = ["management-overview", periodType, week, month];
  const query = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ periodType });
      if (periodType === "monthly") params.set("month", month);
      else params.set("week", week);
      return api<OverviewPayload>(`/api/management-overview?${params.toString()}`);
    },
    staleTime: STALE.operational,
  });

  const teamMetrics = useMemo(() => {
    const card = query.data?.team.scorecard;
    if (!card) return [];
    const order = ["qa", "csat", "sla", "frt", "art", "resolution"] as const;
    const labels: Record<string, string> = {
      qa: "QA Score",
      csat: "CSAT",
      sla: "SLA Compliance",
      frt: "First Response Time",
      art: "Average Response Time",
      resolution: "Resolution Time",
    };
    return order.map((id) => {
      const m = card.metrics.find((x) => x.id === id);
      return {
        id,
        title: labels[id],
        value: m?.actualLabel ?? "N/A",
        target: m?.target != null ? `Target ${id === "qa" ? `≥ ${m.target}/100` : id === "sla" || id === "csat" ? `≥ ${m.target}%` : `≤ ${m.target}h`}` : "Target not configured",
        earned: m ? `Weight ${m.weight} · ${m.pointsDisplay}` : undefined,
        delta: deltaText(query.data?.team.delta.metrics[id] ?? null, id === "qa" || id === "sla" || id === "csat" ? " pts" : " h"),
        prominent: id === "qa" || id === "csat",
      };
    });
  }, [query.data]);

  const filteredAgents = useMemo(() => {
    const list = query.data?.agents ?? [];
    if (agentFilter === "all") return list;
    return list.filter((a) => a.id === agentFilter);
  }, [agentFilter, query.data?.agents]);

  if (query.isPending) return <LoadingBlock />;
  if (query.isError) return <ErrorBlock message={query.error.message} />;
  const data = query.data!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Management Overview"
        description="Consolidated support performance and operational workload for leadership reviews."
        secondaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
              <Button
                type="button"
                size="sm"
                variant={periodType === "weekly" ? "secondary" : "ghost"}
                className="h-8"
                onClick={() => setPeriodType("weekly")}
              >
                Weekly
              </Button>
              <Button
                type="button"
                size="sm"
                variant={periodType === "monthly" ? "secondary" : "ghost"}
                className="h-8"
                onClick={() => setPeriodType("monthly")}
              >
                Monthly
              </Button>
            </div>
            {periodType === "weekly" ? (
              <Select value={week} onValueChange={setWeek}>
                <SelectTrigger className="h-9 w-[12rem] bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...recentWeeks(16)].reverse().map((w) => (
                    <SelectItem key={w} value={w}>{formatWeek(w)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="h-9 w-[12rem] bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...recentMonths(18)].reverse().map((m) => (
                    <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="h-9 w-[11rem] bg-card">
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {data.agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setCompareOpen(true)}>
              Compare Results
            </Button>
          </div>
        }
      />

      <ManagementCompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        periodType={periodType}
        periodAKey={periodType === "weekly" ? week : month}
        agents={data.agents.map((a) => ({ id: a.id, name: a.name }))}
      />

      <ManagementOperationalDetailsDialog
        open={drillOpen}
        onOpenChange={setDrillOpen}
        scope={drillScope}
        periodType={periodType}
        week={week}
        month={month}
        target={drillTarget}
        liveCounts={data.live}
        completedCounts={data.completed}
      />

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{data.period.label}</span>
        {data.period.partial ? " · Month to date" : null}
        {data.period.partial && periodType === "weekly" ? " · Week in progress" : null}
        <span className="mx-2">·</span>
        Compared with {data.period.previousLabel}
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Overall team performance</h2>
        <div className="grid gap-3 lg:grid-cols-4">
          <MetricCard
            title="Overall KPI Score"
            value={data.team.scorecard?.compositeDisplay ?? "N/A"}
            target="Weighted composite (same rules as KPI Performance)"
            delta={deltaText(data.team.delta.overall, " pts")}
            prominent
          />
          {teamMetrics.map((m) => (
            <MetricCard key={m.id} {...m} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Agent performance</h2>
        <p className="text-xs text-muted-foreground">
          Team summary above stays unchanged when filtering agents. Click a row to expand metric details.
        </p>
        <DataTableShell className="overflow-x-auto">
          <table className="w-full min-w-[920px] table-fixed text-sm">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Agent</th>
                <th className="px-3 py-2.5 font-medium text-right">Overall KPI</th>
                <th className="px-3 py-2.5 font-medium text-right">QA</th>
                <th className="px-3 py-2.5 font-medium text-right">CSAT</th>
                <th className="px-3 py-2.5 font-medium text-right">SLA</th>
                <th className="px-3 py-2.5 font-medium text-right">FRT</th>
                <th className="px-3 py-2.5 font-medium text-right">ART</th>
                <th className="px-3 py-2.5 font-medium text-right">Resolution</th>
                <th className="w-10 px-2 py-2.5 font-medium" aria-label="Expand" />
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent) => {
                const m = (id: string) => agent.scorecard?.metrics.find((x) => x.id === id);
                const expanded = expandedAgent === agent.id;
                return (
                  <Fragment key={agent.id}>
                    <tr
                      className="cursor-pointer border-t border-border/50 hover:bg-muted/25"
                      onClick={() => setExpandedAgent(expanded ? null : agent.id)}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">{agent.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {agent.scorecard?.compositeDisplay ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{m("qa")?.actualLabel ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m("csat")?.actualLabel ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m("sla")?.actualLabel ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m("frt")?.actualLabel ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m("art")?.actualLabel ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m("resolution")?.actualLabel ?? "—"}</td>
                      <td className="px-2 py-2">
                        <span
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground"
                          aria-hidden
                        >
                          <ChevronDown className={cn("size-4 motion-safe:transition-transform", expanded && "rotate-180")} />
                        </span>
                      </td>
                    </tr>
                    <tr className="border-t border-border/40 bg-muted/20">
                      <td colSpan={9} className="p-0">
                        <div
                          className={cn(
                            "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200",
                            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                          )}
                        >
                          <div className="overflow-hidden">
                            <ScorecardBreakdownPanel
                              scorecard={agent.scorecard}
                              className="px-3 py-3"
                              emptyMessage={
                                !agent.hasKpiRow && agent.qaReviewCount > 0
                                  ? "No Freshdesk KPI row — QA-only score for this period."
                                  : "No KPI scorecard for this period."
                              }
                              footer={
                                <>
                                  {!agent.hasKpiRow && agent.qaReviewCount > 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      QA reviews in period: {agent.qaReviewCount}
                                    </p>
                                  ) : null}
                                  <KpiPerformanceDeepLink
                                    periodType={periodType}
                                    week={week}
                                    month={month}
                                    agentId={agent.id}
                                  />
                                </>
                              }
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </DataTableShell>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Work completed — selected period</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(COMPLETED_WORK_CATEGORIES) as ManagementDrillModule[]).map((mod) => (
            <WorkstreamBlock
              key={mod}
              title={liveModuleLabel(mod)}
              period
              rows={COMPLETED_WORK_CATEGORIES[mod].map((def) => ({
                categoryKey: def.categoryKey,
                label: def.label,
                count: Number(data.completed[mod]?.[def.countKey] ?? 0),
              }))}
              onMetricClick={(categoryKey) => openDrillDown("completed", mod, categoryKey)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h2 className="text-sm font-semibold text-foreground">Current pending &amp; overdue work</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(Object.entries(data.live) as [ManagementDrillModule, OverviewPayload["live"][string]][]).map(
            ([mod, rows]) => (
              <WorkstreamBlock
                key={mod}
                title={liveModuleLabel(mod)}
                liveBadge
                rows={rows.map((r) => ({
                  categoryKey: r.categoryKey,
                  label: r.label,
                  count: r.count,
                  tone: r.tone,
                }))}
                onMetricClick={(categoryKey) => openDrillDown("live", mod, categoryKey)}
              />
            ),
          )}
        </div>
      </section>
    </div>
  );
}
