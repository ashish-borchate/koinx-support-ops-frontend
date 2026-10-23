import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
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
  live: Record<string, { label: string; count: number; href?: string; tone?: string }[]>;
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
}: {
  title: string;
  rows: { label: string; count: number; href?: string; tone?: string }[];
  period?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {period ? (
        <p className="text-xs text-muted-foreground">Counts for selected reporting period</p>
      ) : (
        <p className="text-xs text-muted-foreground">Live — not affected by period filter</p>
      )}
      <ul className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-2 text-sm">
            {row.href ? (
              <Link className="text-primary hover:underline" to={row.href}>
                {row.label}
              </Link>
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
          </div>
        }
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
          Team summary above stays unchanged when filtering agents. Operational sections below are always live.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Agent</th>
                <th className="px-3 py-2.5 text-right">Overall KPI</th>
                <th className="px-3 py-2.5 text-right">QA</th>
                <th className="px-3 py-2.5 text-right">CSAT</th>
                <th className="px-3 py-2.5 text-right">SLA</th>
                <th className="px-3 py-2.5 text-right">FRT</th>
                <th className="px-3 py-2.5 text-right">ART</th>
                <th className="px-3 py-2.5 text-right">Resolution</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAgents.map((agent) => {
                const m = (id: string) => agent.scorecard?.metrics.find((x) => x.id === id);
                const open = expandedAgent === agent.id;
                return (
                  <Fragment key={agent.id}>
                    <tr className="hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-medium">{agent.name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {agent.scorecard?.compositeDisplay ?? "—"}
                        {agent.delta.overall != null ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({deltaText(agent.delta.overall)})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m("qa")?.actualLabel ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m("csat")?.actualLabel ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m("sla")?.actualLabel ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m("frt")?.actualLabel ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m("art")?.actualLabel ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m("resolution")?.actualLabel ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => setExpandedAgent(open ? null : agent.id)}
                        >
                          <ChevronDown className={cn("size-4", open && "rotate-180")} />
                        </Button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="bg-muted/15">
                        <td colSpan={9} className="px-3 py-3 text-xs text-muted-foreground">
                          {agent.scorecard?.metrics.map((metric) => (
                            <span key={metric.id} className="mr-4 inline-block">
                              {metric.label}: {metric.actualLabel} · earned {metric.pointsDisplay}
                            </span>
                          ))}
                          {!agent.hasKpiRow && agent.qaReviewCount > 0 ? (
                            <span className="block mt-1">No Freshdesk KPI row — QA-only score for this period.</span>
                          ) : null}
                          <Link className="mt-2 inline-block text-primary hover:underline" to={`/kpi?periodType=${periodType}&${periodType === "monthly" ? `month=${month}` : `week=${week}`}&agentId=${agent.id}`}>
                            Open in KPI Performance
                          </Link>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Work completed — selected period</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <WorkstreamBlock
            title="Product Guides"
            period
            rows={[
              { label: "Updated", count: Number(data.completed.productGuides?.updated ?? 0) },
              { label: "Reviewed", count: Number(data.completed.productGuides?.reviewed ?? 0) },
              { label: "Approved", count: Number(data.completed.productGuides?.approved ?? 0) },
              { label: "Published", count: Number(data.completed.productGuides?.published ?? 0) },
            ]}
          />
          <WorkstreamBlock
            title="Integration Steps"
            period
            rows={[
              { label: "Updated", count: Number(data.completed.integrationSteps?.updated ?? 0) },
              { label: "Reviewed", count: Number(data.completed.integrationSteps?.reviewed ?? 0) },
              { label: "Approved", count: Number(data.completed.integrationSteps?.approved ?? 0) },
              { label: "Published by Tech", count: Number(data.completed.integrationSteps?.publishedByTech ?? 0) },
            ]}
          />
          <WorkstreamBlock
            title="Supported Files"
            period
            rows={[
              { label: "Added", count: Number(data.completed.supportedFiles?.added ?? 0) },
              { label: "Updated / replaced", count: Number(data.completed.supportedFiles?.updated ?? 0) },
            ]}
          />
          <WorkstreamBlock
            title="Negative Reviews"
            period
            rows={[
              { label: "Reviews logged", count: Number(data.completed.negativeReviews?.reviewed ?? 0) },
              { label: "Coaching completed", count: Number(data.completed.negativeReviews?.coachingCompleted ?? 0) },
              { label: "Agent ack completed", count: Number(data.completed.negativeReviews?.agentAckCompleted ?? 0) },
            ]}
          />
          <WorkstreamBlock
            title="Product Feedback"
            period
            rows={[
              { label: "Supervisor reviewed", count: Number(data.completed.productFeedback?.reviewed ?? 0) },
              { label: "Approved", count: Number(data.completed.productFeedback?.approved ?? 0) },
              { label: "Shared in Slack", count: Number(data.completed.productFeedback?.sharedInSlack ?? 0) },
            ]}
          />
          <WorkstreamBlock
            title="Token Migration"
            period
            rows={[
              { label: "Migrations recorded", count: Number(data.completed.tokenMigration?.recorded ?? 0) },
              { label: "Tech acknowledgements", count: Number(data.completed.tokenMigration?.techAckCompleted ?? 0) },
            ]}
          />
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h2 className="text-sm font-semibold text-foreground">Current pending &amp; overdue work</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(data.live).map(([key, rows]) => (
            <WorkstreamBlock
              key={key}
              title={key
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (c) => c.toUpperCase())
                .trim()}
              rows={rows}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
