import { Link, Navigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeDialog } from "@/components/date-range-dialog";
import { Empty, ErrorBlock, LoadingBlock, PageHeader, SectionHeader } from "@/components/bits";
import { AgentPerformanceView } from "@/components/performance-center/agent-performance-view";
import {
  PERFORMANCE_CENTER_WEEKLY_REVIEWS_ENABLED,
  buildAgentDashboardQueryString,
} from "@/components/performance-center/constants";
import { buildTeamPeriodQueryString, periodQueryMatchesSelection } from "@/components/performance-center/period-query";
import { PerformanceDetailsDialog } from "@/components/performance-center/performance-details-dialog";
import { PerformanceToolbar } from "@/components/performance-center/performance-toolbar";
import { TeamOverviewView, TeamOverviewSkeleton } from "@/components/performance-center/team-overview-view";
import { WeeklyReviewSection } from "@/components/performance-center/weekly-review-section";
import type {
  AgentDashboard,
  ConcernRow,
  MetricDrillDown,
  PeriodPreset,
  TeamDashboard,
} from "@/components/performance-center/types";
import { PERIOD_PRESETS } from "@/components/performance-center/types";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCalendarDate, formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

const METRIC_PARAMS: MetricDrillDown[] = ["pg-reviews", "pg-compliance", "feedback", "ri-resolved", "qa", "kpi"];

function pendingDays(firstDetectedAt: string | null) {
  if (!firstDetectedAt) return "—";
  const days = Math.max(0, Math.floor((Date.now() - new Date(firstDetectedAt).getTime()) / 86400000));
  return days === 0 ? "<1d" : `${days}d`;
}

function formatAttentionDeadline(row: ConcernRow): string {
  if (row.deadlineAt) {
    const due = new Date(row.deadlineAt);
    const overdue = due.getTime() < Date.now();
    return `${formatWhen(row.deadlineAt)}${overdue ? " · overdue" : ""}`;
  }
  if (row.deadlineIst) {
    return formatCalendarDate(row.deadlineIst);
  }
  if (row.category === "qa" && row.concernType === "pending_acknowledgement") {
    return "No deadline configured";
  }
  return "No deadline configured";
}

function formatAttentionIssue(row: ConcernRow): string {
  switch (row.concernType) {
    case "ack_overdue":
      return "Coaching · Acknowledgement overdue";
    case "pending_acknowledgement":
      return "QA · Pending acknowledgement";
    case "missed_daily_review":
      return "Product Guides · Missed daily review";
    case "overdue_follow_up":
      return "Reported Issues · Follow-up overdue";
    default:
      return row.description;
  }
}

export function PerformanceCenterPage() {
  const { user, effective, can, readOnly } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const attentionRef = useRef<HTMLDivElement>(null);
  const selfId = effective?.id || user?.id || "";

  const canTeamDashboard = can("team_performance.view_team");
  const canTeamActivity = can("agent_activity.view_team");
  const canOwnActivity = can("agent_activity.view_own");
  const canTeamAttention = can("notification_center.view_team");
  const agentOnly =
    (canOwnActivity || can("weekly_reviews.view_own")) && !canTeamDashboard && !canTeamActivity;
  const isEffectiveAgentRole =
    effective?.roleKey === "agent" || effective?.roleKey === "tech_agent";
  const showAgentSelector =
    !isEffectiveAgentRole && !agentOnly && (canTeamDashboard || canTeamActivity);

  const urlAgentId = searchParams.get("agentId") || "";
  const urlReviewId = searchParams.get("reviewId") || searchParams.get("id") || "";
  const urlWeek = searchParams.get("weekStartIst") || "";
  const rawMetric = searchParams.get("metric") || "";
  const urlMetric: MetricDrillDown | null = METRIC_PARAMS.includes(rawMetric as MetricDrillDown)
    ? (rawMetric as MetricDrillDown)
    : null;

  const [preset, setPreset] = useState<PeriodPreset>((searchParams.get("preset") as PeriodPreset) || "this_week");
  const [customFrom, setCustomFrom] = useState(searchParams.get("from") || "");
  const [customTo, setCustomTo] = useState(searchParams.get("to") || "");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [weekStartIst, setWeekStartIst] = useState(urlWeek);
  const [reviewId, setReviewId] = useState(urlReviewId);

  const [attentionAgent, setAttentionAgent] = useState("all");
  const [attentionCategory, setAttentionCategory] = useState("all");
  const [detailsState, setDetailsState] = useState<{ agentId: string; metric: MetricDrillDown } | null>(null);

  const defaultAgentId = agentOnly ? selfId : urlAgentId;
  const viewingAgentId = agentOnly ? selfId : defaultAgentId;
  const showTeamOverview = canTeamDashboard && !viewingAgentId;

  useEffect(() => {
    if (searchParams.get("focus") === "attention" && attentionRef.current) {
      attentionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [searchParams, showTeamOverview]);

  const reviewBootstrapQ = useQuery({
    queryKey: ["weekly-review-bootstrap", urlReviewId],
    queryFn: () => api<{ review: { id: string; agentId: string; weekStartIst: string } }>(`/api/weekly-agent-reviews/${urlReviewId}`),
    enabled: Boolean(urlReviewId) && !viewingAgentId && (canOwnActivity || canTeamActivity),
  });

  useEffect(() => {
    if (reviewBootstrapQ.data?.review && !viewingAgentId) {
      const r = reviewBootstrapQ.data.review;
      const next = new URLSearchParams(searchParams);
      next.set("agentId", r.agentId);
      if (!next.get("weekStartIst")) next.set("weekStartIst", r.weekStartIst);
      next.set("reviewId", r.id);
      setSearchParams(next, { replace: true });
    }
  }, [reviewBootstrapQ.data, viewingAgentId, searchParams, setSearchParams]);

  useEffect(() => {
    const urlPreset = searchParams.get("preset");
    const validPreset = PERIOD_PRESETS.some((p) => p.value === urlPreset);
    setPreset(validPreset && urlPreset ? (urlPreset as PeriodPreset) : "this_week");
    setCustomFrom(searchParams.get("from") || "");
    setCustomTo(searchParams.get("to") || "");
  }, [searchParams]);

  const periodQs = useMemo(
    () => buildTeamPeriodQueryString(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const periodReady = preset !== "custom" || (Boolean(customFrom) && Boolean(customTo));

  const teamQ = useQuery({
    queryKey: ["team-performance", periodQs],
    queryFn: ({ signal }) => api<TeamDashboard>(`/api/team-performance/dashboard?${periodQs}`, { signal }),
    enabled: showTeamOverview && periodReady,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const agentQs = useMemo(
    () => buildAgentDashboardQueryString(viewingAgentId, preset, customFrom, customTo),
    [viewingAgentId, preset, customFrom, customTo],
  );

  const agentQ = useQuery({
    queryKey: ["agent-activity-dashboard", agentQs],
    queryFn: ({ signal }) => api<AgentDashboard>(`/api/agent-activity/dashboard?${agentQs}`, { signal }),
    enabled: Boolean(viewingAgentId) && (canOwnActivity || canTeamActivity) && periodReady,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const teamPeriodSynced =
    Boolean(teamQ.data) &&
    periodQueryMatchesSelection(teamQ.data!.period, preset, customFrom, customTo);
  const agentPeriodSynced =
    Boolean(agentQ.data) &&
    periodQueryMatchesSelection(agentQ.data!.period, preset, customFrom, customTo);

  const detailsAgentId = detailsState?.agentId ?? "";
  const detailsUsesMainAgent = Boolean(detailsState) && detailsAgentId === viewingAgentId && Boolean(agentQ.data);
  const detailsAgentQs = useMemo(
    () => buildAgentDashboardQueryString(detailsAgentId, preset, customFrom, customTo),
    [detailsAgentId, preset, customFrom, customTo],
  );

  const detailsAgentQ = useQuery({
    queryKey: ["agent-activity-dashboard", detailsAgentQs],
    queryFn: ({ signal }) => api<AgentDashboard>(`/api/agent-activity/dashboard?${detailsAgentQs}`, { signal }),
    enabled:
      Boolean(detailsState) &&
      !detailsUsesMainAgent &&
      Boolean(detailsAgentId) &&
      (canOwnActivity || canTeamActivity) &&
      periodReady,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const detailsData = detailsUsesMainAgent ? agentQ.data : detailsAgentQ.data;
  const detailsLoading = detailsUsesMainAgent
    ? agentQ.isLoading && !agentQ.data
    : detailsAgentQ.isLoading && !detailsAgentQ.data;
  const detailsFetching = detailsUsesMainAgent ? agentQ.isFetching : detailsAgentQ.isFetching;

  const attentionQ = useQuery({
    queryKey: ["team-attention"],
    queryFn: () => api<{ items: ConcernRow[] }>("/api/team-attention"),
    enabled: showTeamOverview && canTeamAttention,
  });

  const rosterQ = useQuery({
    queryKey: ["agent-activity-roster"],
    queryFn: () => api<{ agents: { id: string; name: string }[] }>("/api/agent-activity/roster"),
    enabled: canTeamActivity || canTeamDashboard,
  });

  const attentionItems = useMemo(() => {
    let rows = attentionQ.data?.items ?? [];
    if (attentionAgent !== "all") rows = rows.filter((r) => r.agentId === attentionAgent);
    if (attentionCategory !== "all") rows = rows.filter((r) => r.category === attentionCategory);
    const priorityOrder: Record<string, number> = { critical: 0, important: 1, normal: 2 };
    return [...rows].sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));
  }, [attentionQ.data, attentionAgent, attentionCategory]);

  function openAgent(agentId: string) {
    const next = new URLSearchParams(searchParams);
    next.set("agentId", agentId);
    next.delete("focus");
    next.delete("metric");
    setSearchParams(next);
  }

  function openPerformanceDetails(agentId: string, metric: MetricDrillDown) {
    setDetailsState({ agentId, metric });
  }

  function backToTeam() {
    const next = new URLSearchParams(searchParams);
    next.delete("agentId");
    next.delete("reviewId");
    next.delete("id");
    next.delete("metric");
    setSearchParams(next);
  }

  function syncPeriodToUrl(nextPreset: PeriodPreset, from?: string, to?: string) {
    const next = new URLSearchParams(searchParams);
    next.set("preset", nextPreset);
    if (nextPreset === "custom" && from && to) {
      next.set("from", from);
      next.set("to", to);
    } else {
      next.delete("from");
      next.delete("to");
    }
    setSearchParams(next);
  }

  function clearMetricParam() {
    if (!searchParams.get("metric")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("metric");
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    if (urlMetric && viewingAgentId) {
      setDetailsState({ agentId: viewingAgentId, metric: urlMetric });
      clearMetricParam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot URL bootstrap
  }, [urlMetric, viewingAgentId]);

  if (!canOwnActivity && !canTeamActivity && !canTeamDashboard && !can("weekly_reviews.view_own")) {
    return <Empty title="No access" body="You do not have permission to view Performance Center." />;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Performance Center"
        description={
          showTeamOverview
            ? "Team completion, compliance, and follow-ups in one place."
            : "Completed work, responsibilities, and performance for the selected period."
        }
      />

      {teamQ.isFetching || agentQ.isFetching ? (
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-pulse bg-primary/50" />
        </div>
      ) : null}

      <PerformanceToolbar
        mode={showTeamOverview ? "team" : "agent"}
        preset={preset}
        onPresetChange={(next) => {
          setPreset(next);
          syncPeriodToUrl(next, customFrom, customTo);
          if (next === "custom") setRangeOpen(true);
        }}
        periodLabel={
          (teamPeriodSynced ? teamQ.data?.period.label : agentPeriodSynced ? agentQ.data?.period.label : null) ?? null
        }
        periodStartIst={
          teamPeriodSynced ? teamQ.data?.period.startIst : agentPeriodSynced ? agentQ.data?.period.startIst : undefined
        }
        periodEndIst={
          teamPeriodSynced ? teamQ.data?.period.endIst : agentPeriodSynced ? agentQ.data?.period.endIst : undefined
        }
        isPeriodUpdating={
          (showTeamOverview && teamQ.isFetching && !teamPeriodSynced) ||
          (Boolean(viewingAgentId) && agentQ.isFetching && !agentPeriodSynced)
        }
        customFrom={customFrom}
        customTo={customTo}
        onOpenCustomRange={() => setRangeOpen(true)}
        agents={showAgentSelector ? rosterQ.data?.agents : undefined}
        selectedAgentId={viewingAgentId || undefined}
        onAgentChange={showAgentSelector ? (id) => openAgent(id) : undefined}
        agentName={agentQ.data?.agent.name}
        showTeamButton={Boolean(viewingAgentId && canTeamDashboard)}
        onBackToTeam={backToTeam}
      />

      <DateRangeDialog
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        initialFrom={customFrom}
        initialTo={customTo}
        onConfirm={(from, to) => {
          setCustomFrom(from);
          setCustomTo(to);
          setPreset("custom");
          syncPeriodToUrl("custom", from, to);
        }}
      />

      {showTeamOverview ? (
        <>
          {teamQ.isError ? <ErrorBlock message={(teamQ.error as Error).message} /> : null}
          {teamQ.data ? (
            <div className="relative">
              {!teamPeriodSynced && teamQ.isFetching ? (
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/55 backdrop-blur-[1px]"
                  aria-live="polite"
                >
                  <p className="rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
                    Loading {PERIOD_PRESETS.find((p) => p.value === preset)?.label ?? "period"}…
                  </p>
                </div>
              ) : null}
              <div className={cn(!teamPeriodSynced && teamQ.isFetching && "opacity-50")}>
                <TeamOverviewView
                  data={teamQ.data}
                  onSelectAgent={openAgent}
                  onOpenDetails={openPerformanceDetails}
                />
              </div>
            </div>
          ) : teamQ.isLoading ? (
            <TeamOverviewSkeleton />
          ) : null}

          {canTeamAttention ? (
            <div ref={attentionRef} className="space-y-4">
              <SectionHeader title="Needs attention" description="Unresolved operational concerns. Rows clear automatically when work is completed." />
              <div className="flex flex-wrap gap-3">
                <Select value={attentionAgent} onValueChange={setAttentionAgent}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents</SelectItem>
                    {(rosterQ.data?.agents ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={attentionCategory} onValueChange={setAttentionCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="product_guides">Product Guides</SelectItem>
                    <SelectItem value="reported_issues">Reported Issues</SelectItem>
                    <SelectItem value="qa">QA</SelectItem>
                    <SelectItem value="coaching">Coaching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {attentionQ.isLoading ? <LoadingBlock /> : null}
              {attentionItems.length === 0 && !attentionQ.isLoading ? (
                <Empty title="No open concerns" body="Nothing requires follow-up for these filters." />
              ) : (
                <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)]">
                  <table className="w-full min-w-[760px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[16%]" />
                      <col className="w-[36%]" />
                      <col className="w-[22%]" />
                      <col className="w-[10%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Agent</th>
                        <th className="px-3 py-2 font-medium">Issue</th>
                        <th className="px-3 py-2 font-medium">Deadline</th>
                        <th className="px-3 py-2 font-medium">Pending</th>
                        <th className="px-3 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {attentionItems.map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="px-3 py-1.5 align-middle">
                            <button
                              type="button"
                              className="max-w-full truncate text-left font-medium text-primary hover:underline"
                              onClick={() => openAgent(row.agentId)}
                            >
                              {row.agentName}
                            </button>
                          </td>
                          <td className="px-3 py-1.5 align-middle text-muted-foreground">
                            <span className="line-clamp-2 text-foreground">{formatAttentionIssue(row)}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 align-middle text-muted-foreground">
                            {formatAttentionDeadline(row)}
                          </td>
                          <td className="px-3 py-1.5 align-middle tabular-nums">{pendingDays(row.firstDetectedAt)}</td>
                          <td className="px-3 py-1.5 text-right align-middle">
                            <Button size="sm" variant="outline" asChild>
                              <Link to={row.destinationUrl}>Open record</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {viewingAgentId ? (
        <>
          {agentQ.isError ? <ErrorBlock message={(agentQ.error as Error).message} /> : null}
          {agentQ.data ? (
            <div className="relative">
              {!agentPeriodSynced && agentQ.isFetching ? (
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/55 backdrop-blur-[1px]"
                  aria-live="polite"
                >
                  <p className="rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
                    Loading {PERIOD_PRESETS.find((p) => p.value === preset)?.label ?? "period"}…
                  </p>
                </div>
              ) : null}
              <AgentPerformanceView
                data={agentQ.data}
                preset={preset}
                customFrom={customFrom}
                customTo={customTo}
                onOpenDetails={(metric) => openPerformanceDetails(viewingAgentId, metric)}
                isRefreshing={!agentPeriodSynced && agentQ.isFetching}
              />
            </div>
          ) : agentQ.isLoading ? (
            <LoadingBlock />
          ) : null}

          {PERFORMANCE_CENTER_WEEKLY_REVIEWS_ENABLED &&
          (can("weekly_reviews.view_own") || can("weekly_reviews.view_team") || can("weekly_reviews.manage")) &&
          viewingAgentId ? (
            <WeeklyReviewSection
              agentId={viewingAgentId}
              weekStartIst={weekStartIst}
              selectedReviewId={reviewId}
              readOnly={readOnly}
              onWeekChange={(w) => {
                setWeekStartIst(w);
                const next = new URLSearchParams(searchParams);
                next.set("weekStartIst", w);
                setSearchParams(next);
              }}
              onReviewSelect={(id) => {
                setReviewId(id);
                const next = new URLSearchParams(searchParams);
                if (id) next.set("reviewId", id);
                else next.delete("reviewId");
                setSearchParams(next);
              }}
            />
          ) : null}
        </>
      ) : !showTeamOverview && !viewingAgentId ? (
        <Empty title="Select an agent" body="Choose an agent from Team overview or use your personal link." />
      ) : null}

      {detailsState ? (
        <PerformanceDetailsDialog
          open
          onOpenChange={(open) => {
            if (!open) setDetailsState(null);
          }}
          metric={detailsState.metric}
          onMetricChange={(metric) => setDetailsState((s) => (s ? { ...s, metric } : s))}
          data={detailsData}
          isLoading={detailsLoading}
          isFetching={detailsFetching}
        />
      ) : null}
    </div>
  );
}

export function LegacyPerformanceRedirect({
  mode,
}: {
  mode: "agent" | "team" | "attention" | "weekly";
}) {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  if (mode === "team") next.delete("agentId");
  if (mode === "attention") next.set("focus", "attention");
  if (mode === "weekly") {
    const legacyId = next.get("id");
    if (legacyId && !next.get("reviewId")) next.set("reviewId", legacyId);
  }
  const q = next.toString();
  return <Navigate to={q ? `/performance-center?${q}` : "/performance-center"} replace />;
}
