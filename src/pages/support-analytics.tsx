import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorBlock, LoadingBlock, PageHeader, SectionHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatCalendarDate } from "@/lib/format";
import { STALE } from "@/lib/query-client";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SupportAnalyticsHistoricalPanel } from "@/pages/support-analytics-historical-panel";
import { SupportAnalyticsLiveAgentWorkload } from "@/components/support-analytics/live-agent-workload";
import { SupportAnalyticsLiveGroupWorkload } from "@/components/support-analytics/live-group-workload";
import { SupportAnalyticsSchedulerStatusPanel } from "@/components/support-analytics/scheduler-status-panel";
import { ReportingPeriodSection } from "@/components/support-analytics/reporting-period-section";
import type { DatePresetId } from "@/lib/support-analytics-date-presets";
import {
  LiveBacklogMetricCard,
  LiveDurationCard,
  LivePeriodCountCard,
} from "@/components/support-analytics/live-metric-card";
import type { LiveMetricDefinition } from "@/components/support-analytics/live-metric-info";
import {
  SupportAnalyticsTicketExplorerModal,
  type SupportAnalyticsTicketExplorerRequest,
} from "@/components/support-analytics/ticket-explorer-modal";

type DurationMetric = {
  available: boolean;
  count: number;
  averageMs: number | null;
  medianMs: number | null;
  note: string;
};

type OverviewPayload = {
  range: { from: string; to: string; timezone: string; source?: string };
  compare: unknown;
  freshness: {
    lastSuccessfulTicketSyncAt: string | null;
    ticketsStored: number;
    coverageNote: string;
    lastError: string;
    partialBackfill: boolean;
    lastSyncStatus: string | null;
    lastSyncMessage: string | null;
    lastScheduledAttempt?: {
      status?: string;
      message?: string;
      labelIst?: string | null;
    } | null;
    schedule?: {
      nextScheduledLabelIst?: string;
      inQuietHours?: boolean;
    };
    display?: {
      status?: string;
      lastSuccessfulSyncLabelIst?: string | null;
      lastSuccessfulSyncTrigger?: string | null;
      lastSyncType?: string | null;
      nextScheduledLabelIst?: string | null;
      latestScheduledStatus?: string | null;
      latestScheduledLabelIst?: string | null;
      latestScheduledFinishedLabelIst?: string | null;
      latestScheduledMessage?: string | null;
      latestScheduledSkipReason?: string | null;
      schedulerFreshnessWarning?: string | null;
      schedulerSecretConfiguredOnServer?: boolean;
    };
    scheduler?: {
      secretConfiguredOnServer?: boolean;
      freshnessWarning?: string | null;
    };
  };
  periodActivity: {
    ticketsCreated: number;
    ticketsResolved: number;
    firstResponseTime: DurationMetric;
    resolutionTime: DurationMetric & { resolutionTimestampPolicy?: string };
  };
  snapshot: {
    label: string;
    metrics: {
      backlogOpen: number;
      statusOpen: number;
      waitingOnCustomer: number;
      pending: number;
      assignedToAi?: number;
      unassigned: number;
      overdueResolution: number;
      highUrgent: number;
      overdueFirstResponse: number;
    };
    breakdown: {
      byStatus: { id: number; label: string; count: number }[];
      byPriority: { id: number; label: string; count: number }[];
    };
  };
  definitions: { id: string; label: string; description: string; kind: string; notes?: string }[];
};

function definitionFromApi(
  definitions: OverviewPayload["definitions"],
  id: string,
  fallback: LiveMetricDefinition,
): LiveMetricDefinition {
  const row = definitions.find((d) => d.id === id);
  if (!row) return fallback;
  return {
    label: row.label,
    description: row.description,
    kind: row.kind,
    notes: row.notes,
  };
}

const SNAPSHOT_FALLBACKS: Record<string, LiveMetricDefinition> = {
  status_open: {
    label: "Open",
    kind: "snapshot",
    description: "Tickets in Freshdesk status Open (2) among synced backlog at the latest snapshot.",
  },
  waiting: {
    label: "Waiting on customer",
    kind: "snapshot",
    description: "Tickets in Freshdesk status Waiting on Customer (6) among synced backlog.",
  },
  high_urgent: {
    label: "High / urgent priority",
    kind: "snapshot",
    description:
      "Backlog tickets with Freshdesk priority High (3) or Urgent (4). Overlaps status counts — not added into total backlog twice.",
  },
};

export function SupportAnalyticsPage() {
  const { can, readOnly } = useAuth();
  const qc = useQueryClient();
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [explorerRequest, setExplorerRequest] = useState<SupportAnalyticsTicketExplorerRequest | null>(null);
  const rangeInit = useRef(false);
  const [mainTab, setMainTab] = useState<"live" | "historical">("live");
  const [syncDetailsOpen, setSyncDetailsOpen] = useState(false);
  const [periodPreset, setPeriodPreset] = useState<DatePresetId>("custom");

  const queryKey = useMemo(
    () => ["support-analytics", "overview", appliedFrom, appliedTo],
    [appliedFrom, appliedTo],
  );

  const overview = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (appliedFrom && appliedTo) {
        params.set("from", appliedFrom);
        params.set("to", appliedTo);
      }
      const q = params.toString();
      return api<OverviewPayload>(`/api/support-analytics/overview${q ? `?${q}` : ""}`);
    },
    staleTime: STALE.operational,
  });

  const data = overview.data;

  useEffect(() => {
    if (!data?.range || rangeInit.current) return;
    rangeInit.current = true;
    setDraftFrom(data.range.from);
    setDraftTo(data.range.to);
    setAppliedFrom(data.range.from);
    setAppliedTo(data.range.to);
  }, [data?.range]);

  const syncStatus = useQuery({
    queryKey: ["support-analytics", "sync-status"],
    queryFn: () => api<Record<string, unknown>>("/api/support-analytics/sync/status"),
    staleTime: 15_000,
    refetchInterval: mainTab === "live" ? 20_000 : false,
  });

  const syncRun = useMutation({
    mutationFn: () =>
      api<{ run: { status: string; message: string } }>("/api/support-analytics/sync/run", { method: "POST" }),
    onSuccess: (payload) => {
      qc.invalidateQueries({ queryKey: ["support-analytics"] });
      void syncStatus.refetch();
      const run = payload?.run;
      if (run?.message) {
        toast.success(
          run.status === "success" || run.status === "partial" ? run.message : `Sync ${run.status}: ${run.message}`,
        );
      } else {
        toast.success("Freshdesk sync finished");
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Freshdesk sync failed");
    },
  });

  function applyReportingRange(from: string, to: string) {
    if (!from || !to) {
      toast.error("Select both From and To dates.");
      return;
    }
    if (from > to) {
      toast.error("From date cannot be later than To date.");
      return;
    }
    setDraftFrom(from);
    setDraftTo(to);
    setAppliedFrom(from);
    setAppliedTo(to);
    setExplorerRequest(null);
  }

  function openLiveTickets(
    title: string,
    kind: string,
    extra: Record<string, string> = {},
    subtitleOverride?: string,
  ) {
    const periodKinds = new Set(["created", "resolved"]);
    const queryParams: Record<string, string> = { kind, limit: "500", ...extra };
    if (periodKinds.has(kind) && appliedFrom && appliedTo) {
      queryParams.from = appliedFrom;
      queryParams.to = appliedTo;
    }
    const subtitle =
      periodKinds.has(kind) && appliedFrom && appliedTo
        ? `${formatCalendarDate(appliedFrom)} – ${formatCalendarDate(appliedTo)} (IST) · Live sync store`
        : "Latest Live sync snapshot";
    setExplorerRequest({
      source: "live",
      title,
      subtitle: subtitleOverride ?? subtitle,
      exportFileName: `live-${kind}.csv`,
      queryParams,
    });
  }

  const canSync = can("support_analytics.sync") && !readOnly;
  const freshness = data?.freshness;
  const definitions = data?.definitions ?? [];
  const overviewErrorMessage =
    overview.error instanceof Error && overview.error.message
      ? overview.error.message
      : "Could not load Support Analytics.";
  const syncErrorMessage =
    syncRun.error instanceof Error && syncRun.error.message
      ? syncRun.error.message
      : "Freshdesk sync failed.";

  const showSyncHistory = mainTab === "live" && Boolean(freshness?.display);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        eyebrow="Operations"
        title="Support Analytics"
        description="Freshdesk ticket operations — separate from official KPI Performance scoring."
        action={
          (canSync && mainTab === "live") || showSyncHistory ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canSync && mainTab === "live" ? (
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 min-w-[8.5rem] px-4"
                  disabled={syncRun.isPending}
                  onClick={() => syncRun.mutate()}
                >
                  {syncRun.isPending ? "Syncing…" : "Sync Freshdesk"}
                </Button>
              ) : null}
              {showSyncHistory ? (
                <Popover open={syncDetailsOpen} onOpenChange={setSyncDetailsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 px-4"
                      aria-expanded={syncDetailsOpen}
                    >
                      Sync History
                      {syncDetailsOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="z-[200] w-[min(22rem,calc(100vw-2rem))] p-3">
                    <SupportAnalyticsSchedulerStatusPanel
                      display={freshness!.display}
                      inOperationalWindow={freshness!.schedule?.inQuietHours === false}
                      ticketsStored={freshness!.ticketsStored}
                    />
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>
          ) : null
        }
      />

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "live" | "historical")} className="gap-4">
        <nav className="flex flex-wrap gap-1.5 border-b border-border pb-2" aria-label="Analytics mode">
          {(
            [
              { id: "live" as const, label: "Live Sync" },
              { id: "historical" as const, label: "Historical Analysis" },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              aria-pressed={mainTab === mode.id}
              onClick={() => setMainTab(mode.id)}
              className={cn(
                "rounded-lg border px-3.5 py-2 text-sm font-medium motion-safe:transition-colors",
                mainTab === mode.id
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {mode.label}
            </button>
          ))}
        </nav>
        <TabsContent value="historical" className="mt-4">
          <SupportAnalyticsHistoricalPanel />
        </TabsContent>
        <TabsContent value="live" className="mt-0 space-y-4">
          {syncRun.isPending ? <LoadingBlock label="Syncing Freshdesk tickets into the analytics store…" /> : null}

          {syncRun.isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <p className="font-medium">Sync failed</p>
              <p className="mt-1">{syncErrorMessage}</p>
            </div>
          ) : null}

          {overview.isLoading ? <LoadingBlock label="Loading analytics…" /> : null}
          {overview.isError ? <ErrorBlock message={overviewErrorMessage} /> : null}

          {data ? (
            <>
              <section className="space-y-3">
                <SectionHeader title="Live Operation Dashboard" />
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  <LiveBacklogMetricCard
                    label="Total backlog"
                    value={data.snapshot.metrics.backlogOpen}
                    definition={definitionFromApi(definitions, "backlog_open", {
                      label: "Total backlog",
                      kind: "snapshot",
                      description: "Unresolved workload statuses in the Live store.",
                    })}
                    onDrill={() => openLiveTickets("Total backlog", "backlog")}
                  />
                  <LiveBacklogMetricCard
                    label="Unassigned backlog"
                    value={data.snapshot.metrics.unassigned}
                    definition={definitionFromApi(definitions, "unassigned", {
                      label: "Unassigned",
                      kind: "snapshot",
                      description: "Backlog tickets with no responder_id at last sync.",
                    })}
                    onDrill={() => openLiveTickets("Unassigned backlog", "unassigned")}
                  />
                  <LiveBacklogMetricCard
                    label="Open"
                    value={data.snapshot.metrics.statusOpen}
                    definition={definitionFromApi(definitions, "status_open", SNAPSHOT_FALLBACKS.status_open)}
                    onDrill={() => openLiveTickets("Open", "open")}
                  />
                  <LiveBacklogMetricCard
                    label="Waiting on customer"
                    value={data.snapshot.metrics.waitingOnCustomer}
                    definition={definitionFromApi(definitions, "waiting", SNAPSHOT_FALLBACKS.waiting)}
                    onDrill={() => openLiveTickets("Waiting on customer", "waiting")}
                  />
                  <LiveBacklogMetricCard
                    label="Pending"
                    value={data.snapshot.metrics.pending}
                    definition={definitionFromApi(definitions, "pending_count", {
                      label: "Pending",
                      kind: "snapshot",
                      description: "Tickets in Freshdesk status Pending (3) among synced backlog.",
                    })}
                    onDrill={() => openLiveTickets("Pending", "pending")}
                  />
                  <LiveBacklogMetricCard
                    label="Overdue (resolution SLA)"
                    value={data.snapshot.metrics.overdueResolution}
                    definition={definitionFromApi(definitions, "overdue_resolution", {
                      label: "Overdue (resolution SLA)",
                      kind: "fact",
                      description: "Backlog tickets where due_by is set and due_by < now (UTC).",
                    })}
                    onDrill={() => openLiveTickets("Overdue (resolution)", "overdue_resolution")}
                  />
                  <LiveBacklogMetricCard
                    label="High / urgent priority"
                    value={data.snapshot.metrics.highUrgent}
                    definition={definitionFromApi(definitions, "high_urgent", SNAPSHOT_FALLBACKS.high_urgent)}
                    onDrill={() => openLiveTickets("High / urgent priority", "high_urgent")}
                  />
                  <LiveBacklogMetricCard
                    label="FR SLA overdue / missed"
                    value={data.snapshot.metrics.overdueFirstResponse}
                    definition={definitionFromApi(definitions, "overdue_first_response", {
                      label: "Overdue / missed first response SLA",
                      kind: "fact",
                      description:
                        "Unresolved backlog tickets where fr_due_by is set, now is past fr_due_by, and stats.first_responded_at is absent.",
                    })}
                    onDrill={() =>
                      openLiveTickets("FR SLA overdue (no first response)", "overdue_first_response")
                    }
                  />
                  {(data.snapshot.metrics.assignedToAi ?? 0) > 0 ? (
                    <LiveBacklogMetricCard
                      label="Assigned to AI"
                      value={data.snapshot.metrics.assignedToAi!}
                      definition={{
                        label: "Assigned to AI",
                        kind: "snapshot",
                        description: "Backlog in Freshdesk Assigned to AI Agent status (9000).",
                      }}
                      onDrill={() => openLiveTickets("Assigned to AI", "assigned_to_ai")}
                    />
                  ) : null}
                </div>
              </section>

              <SupportAnalyticsLiveGroupWorkload onExplore={setExplorerRequest} />

              <SupportAnalyticsLiveAgentWorkload onExplore={setExplorerRequest} />

              <section className="space-y-3 rounded-xl border border-border bg-card/40 p-3 sm:p-4">
                <SectionHeader title="Selected Period Data — Not Live" />
                <ReportingPeriodSection
                  draftFrom={draftFrom}
                  draftTo={draftTo}
                  appliedFrom={appliedFrom}
                  appliedTo={appliedTo}
                  preset={periodPreset}
                  onPresetChange={setPeriodPreset}
                  onDraftFrom={setDraftFrom}
                  onDraftTo={setDraftTo}
                  onApply={applyReportingRange}
                  showIstInSummary={false}
                />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <LivePeriodCountCard
                    label="Tickets created"
                    value={data.periodActivity.ticketsCreated}
                    definition={definitionFromApi(definitions, "tickets_created", {
                      label: "Tickets created",
                      kind: "fact",
                      description: "Tickets created in the reporting period.",
                    })}
                    onDrill={() => openLiveTickets("Tickets created", "created")}
                  />
                  <LivePeriodCountCard
                    label="Tickets resolved"
                    value={data.periodActivity.ticketsResolved}
                    definition={definitionFromApi(definitions, "tickets_resolved", {
                      label: "Tickets resolved",
                      kind: "fact",
                      description: "Tickets resolved in the reporting period.",
                    })}
                    onDrill={() => openLiveTickets("Tickets resolved", "resolved")}
                  />
                  <LiveDurationCard
                    label="First response time"
                    available={data.periodActivity.firstResponseTime.available}
                    count={data.periodActivity.firstResponseTime.count}
                    averageMs={data.periodActivity.firstResponseTime.averageMs}
                    medianMs={data.periodActivity.firstResponseTime.medianMs}
                    definition={definitionFromApi(definitions, "first_response_time", {
                      label: "First response time",
                      kind: "fact",
                      description: data.periodActivity.firstResponseTime.note,
                    })}
                    extraNote={data.periodActivity.firstResponseTime.note}
                    onDrill={() =>
                      openLiveTickets(
                        "First response time",
                        "created",
                        {},
                        appliedFrom && appliedTo
                          ? `${formatCalendarDate(appliedFrom)} – ${formatCalendarDate(appliedTo)} (IST) · n = ${data.periodActivity.firstResponseTime.count} tickets with first response`
                          : `n = ${data.periodActivity.firstResponseTime.count} tickets with first response`,
                      )
                    }
                  />
                  <LiveDurationCard
                    label="Resolution time"
                    available={data.periodActivity.resolutionTime.available}
                    count={data.periodActivity.resolutionTime.count}
                    averageMs={data.periodActivity.resolutionTime.averageMs}
                    medianMs={data.periodActivity.resolutionTime.medianMs}
                    definition={definitionFromApi(definitions, "resolution_time", {
                      label: "Resolution time",
                      kind: "fact",
                      description: data.periodActivity.resolutionTime.note,
                    })}
                    extraNote={
                      data.periodActivity.resolutionTime.resolutionTimestampPolicy ||
                      data.periodActivity.resolutionTime.note
                    }
                    onDrill={() =>
                      openLiveTickets(
                        "Resolution time",
                        "resolved",
                        {},
                        appliedFrom && appliedTo
                          ? `${formatCalendarDate(appliedFrom)} – ${formatCalendarDate(appliedTo)} (IST) · n = ${data.periodActivity.resolutionTime.count} tickets in average`
                          : `n = ${data.periodActivity.resolutionTime.count} tickets in average`,
                      )
                    }
                  />
                </div>
              </section>
            </>
          ) : null}

          <SupportAnalyticsTicketExplorerModal request={explorerRequest} onClose={() => setExplorerRequest(null)} />

          {syncRun.data?.run ? (
            <p className="text-xs text-muted-foreground">
              Manual sync: {syncRun.data.run.status} — {syncRun.data.run.message}
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
