import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, RefreshCw } from "lucide-react";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  SectionHeader,
} from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatCalendarDate, formatDurationHours, formatNumber } from "@/lib/format";
import { STALE } from "@/lib/query-client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupportAnalyticsHistoricalPanel } from "@/pages/support-analytics-historical-panel";
import { SupportAnalyticsLiveAgentWorkload } from "@/components/support-analytics/live-agent-workload";
import { SupportAnalyticsSchedulerStatusPanel } from "@/components/support-analytics/scheduler-status-panel";
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

type CompareNumber = {
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;
  deltaPctLabel: string;
};

type CompareDuration = {
  currentMs: number | null;
  previousMs: number | null;
  deltaMs: number | null;
  deltaPctLabel: string;
  currentCount: number;
  previousCount: number;
};

type OverviewPayload = {
  range: { from: string; to: string; timezone: string; source?: string };
  compare: {
    range: { from: string; to: string; timezone: string };
    periodActivity: {
      ticketsCreated: CompareNumber;
      ticketsResolved: CompareNumber;
      firstResponseTimeAvg: CompareDuration;
      resolutionTimeAvg: CompareDuration;
    };
    hasPriorSyncedData: boolean;
  } | null;
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

function formatMsDuration(ms: number | null | undefined) {
  if (ms == null || Number.isNaN(ms)) return "—";
  return formatDurationHours(ms / 3_600_000);
}

function MetricCard({
  title,
  value,
  hint,
  onDrill,
}: {
  title: string;
  value: number | string;
  hint?: string;
  onDrill?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onDrill}
      className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40 disabled:cursor-default"
      disabled={!onDrill}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </button>
  );
}

function TimingCard({ title, metric }: { title: string; metric: DurationMetric }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {metric.available ? (
        <>
          <p className="mt-2 text-lg font-semibold text-foreground">
            Avg {formatMsDuration(metric.averageMs)} · Median {formatMsDuration(metric.medianMs)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">n = {formatNumber(metric.count)} tickets</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">—</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{metric.note}</p>
    </div>
  );
}

function scheduledAttemptLabel(status?: string | null) {
  switch (status) {
    case "success":
      return "Succeeded";
    case "partial":
      return "Partial";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    case "running":
      return "Running";
    default:
      return status || "Not yet recorded";
  }
}

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

  function applyDateRange() {
    if (!draftFrom || !draftTo) {
      toast.error("Select both From and To dates (IST).");
      return;
    }
    if (draftFrom > draftTo) {
      toast.error("From date cannot be later than To date.");
      return;
    }
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setExplorerRequest(null);
  }

  function openLiveTickets(title: string, kind: string, extra: Record<string, string> = {}) {
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
      subtitle,
      exportFileName: `live-${kind}.csv`,
      queryParams,
    });
  }

  const canSync = can("support_analytics.sync") && !readOnly;
  const freshness = data?.freshness;
  const overviewErrorMessage =
    overview.error instanceof Error && overview.error.message
      ? overview.error.message
      : "Could not load Support Analytics.";
  const syncErrorMessage =
    syncRun.error instanceof Error && syncRun.error.message
      ? syncRun.error.message
      : "Freshdesk sync failed.";

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        eyebrow="Operations"
        title="Support Analytics"
        description="Freshdesk ticket operations — separate from official KPI Performance scoring."
        action={
          canSync ? (
            <Button variant="outline" size="sm" disabled={syncRun.isPending} onClick={() => syncRun.mutate()}>
              <RefreshCw className={syncRun.isPending ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              {syncRun.isPending ? "Syncing…" : "Sync Freshdesk"}
            </Button>
          ) : null
        }
      />

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "live" | "historical")}>
        <TabsList>
          <TabsTrigger value="live">Live (API sync)</TabsTrigger>
          <TabsTrigger value="historical">Historical Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="historical" className="mt-6">
          <SupportAnalyticsHistoricalPanel />
        </TabsContent>
        <TabsContent value="live" className="mt-6 space-y-8">
      {syncRun.isPending ? <LoadingBlock label="Syncing Freshdesk tickets into the analytics store…" /> : null}

      {syncRun.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Sync failed</p>
          <p className="mt-1">{syncErrorMessage}</p>
        </div>
      ) : null}

      {freshness ? (
        <div className="space-y-2">
          <SupportAnalyticsSchedulerStatusPanel
            display={freshness.display}
            inOperationalWindow={freshness.schedule?.inQuietHours === false}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Tickets tracked (Live store)</dt>
                <dd className="font-semibold tabular-nums">{formatNumber(freshness.ticketsStored)}</dd>
              </div>
            </dl>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Important note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Live analytics data</DialogTitle>
              </DialogHeader>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>This dashboard uses tickets successfully synced into the Support Analytics store.</li>
                <li>Incremental sync may not yet include every older Freshdesk ticket.</li>
                <li>Backlog counts reflect the latest stored snapshot, not guaranteed full Freshdesk volume.</li>
                <li>Period metrics use available stored tickets for the dates you select.</li>
                <li>
                  Last successful sync:{" "}
                  <strong>{freshness.display?.lastSuccessfulSyncLabelIst || "—"}</strong>
                  {freshness.lastSyncStatus ? (
                    <>
                      {" "}
                      · Latest run: <strong>{freshness.lastSyncStatus}</strong>
                      {freshness.lastSyncMessage ? ` — ${freshness.lastSyncMessage}` : ""}
                    </>
                  ) : null}
                </li>
                {freshness.display?.latestScheduledStatus ? (
                  <li>
                    Latest scheduled attempt:{" "}
                    <strong>{scheduledAttemptLabel(freshness.display.latestScheduledStatus)}</strong>
                    {freshness.display.latestScheduledMessage ? ` — ${freshness.display.latestScheduledMessage}` : ""}
                  </li>
                ) : null}
              </ul>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">From (IST)</label>
          <Input type="date" className="h-9 w-40" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To (IST)</label>
          <Input type="date" className="h-9 w-40" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
        </div>
        <Button size="sm" onClick={applyDateRange}>
          Apply range
        </Button>
        {data?.definitions ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Info className="mr-2 h-4 w-4" />
                Metric definitions
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Metric definitions</DialogTitle>
              </DialogHeader>
              <ul className="space-y-3 text-sm">
                {data.definitions.map((d) => (
                  <li key={d.id}>
                    <p className="font-medium">
                      {d.label}{" "}
                      <span className="text-xs font-normal text-muted-foreground">({d.kind})</span>
                    </p>
                    <p className="text-muted-foreground">{d.description}</p>
                    {d.notes ? <p className="text-xs text-amber-700 dark:text-amber-400">{d.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {overview.isLoading ? <LoadingBlock label="Loading analytics…" /> : null}
      {overview.isError ? <ErrorBlock message={overviewErrorMessage} /> : null}

      {data ? (
        <>
          <p className="text-sm font-medium text-foreground">
            Reporting period: {formatCalendarDate(data.range.from)} – {formatCalendarDate(data.range.to)} (IST)
            {data.range.source === "default" ? (
              <span className="ml-2 font-normal text-muted-foreground">(default rolling window)</span>
            ) : null}
          </p>

          <SectionHeader title="Selected-period activity" />
          <p className="text-xs text-muted-foreground">
            Counts and timings below use only tickets in the analytics store for the reporting period.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Tickets created"
              value={data.periodActivity.ticketsCreated}
              onDrill={() => openLiveTickets("Tickets created", "created")}
            />
            <MetricCard
              title="Tickets resolved"
              value={data.periodActivity.ticketsResolved}
              onDrill={() => openLiveTickets("Tickets resolved", "resolved")}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TimingCard title="First response time" metric={data.periodActivity.firstResponseTime} />
            <TimingCard title="Resolution time" metric={data.periodActivity.resolutionTime} />
          </div>
          {data.periodActivity.resolutionTime.resolutionTimestampPolicy ? (
            <p className="text-xs text-muted-foreground">{data.periodActivity.resolutionTime.resolutionTimestampPolicy}</p>
          ) : null}

          <SectionHeader title={data.snapshot.label} />
          <p className="-mt-2 text-xs text-muted-foreground">
            Backlog is Open + Pending + Waiting + other unresolved statuses. Overdue and High/Urgent overlap status
            counts and are not added again.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total backlog"
              value={data.snapshot.metrics.backlogOpen}
              hint="All unresolved backlog statuses"
              onDrill={() => openLiveTickets("Total backlog", "backlog")}
            />
            <MetricCard
              title="Open"
              value={data.snapshot.metrics.statusOpen}
              hint="Freshdesk status Open"
              onDrill={() => openLiveTickets("Open", "open")}
            />
            <MetricCard
              title="Waiting on customer"
              value={data.snapshot.metrics.waitingOnCustomer}
              onDrill={() => openLiveTickets("Waiting on customer", "waiting")}
            />
            <MetricCard
              title="Pending"
              value={data.snapshot.metrics.pending}
              onDrill={() => openLiveTickets("Pending", "pending")}
            />
            {(data.snapshot.metrics.assignedToAi ?? 0) > 0 ? (
              <MetricCard
                title="Assigned to AI"
                value={data.snapshot.metrics.assignedToAi!}
                onDrill={() => openLiveTickets("Assigned to AI", "assigned_to_ai")}
              />
            ) : null}
            <MetricCard
              title="Unassigned backlog"
              value={data.snapshot.metrics.unassigned}
              hint="No assignee at last sync"
              onDrill={() => openLiveTickets("Unassigned backlog", "unassigned")}
            />
            <MetricCard
              title="Overdue (resolution SLA)"
              value={data.snapshot.metrics.overdueResolution}
              onDrill={() => openLiveTickets("Overdue (resolution)", "overdue_resolution")}
            />
            <MetricCard
              title="High / urgent priority"
              value={data.snapshot.metrics.highUrgent}
              onDrill={() => openLiveTickets("High / urgent priority", "high_urgent")}
            />
            <MetricCard
              title="FR SLA overdue / missed"
              value={data.snapshot.metrics.overdueFirstResponse}
              hint="First response not met on open backlog"
              onDrill={() =>
                openLiveTickets("FR SLA overdue (no first response)", "overdue_first_response")
              }
            />
          </div>

          <SupportAnalyticsLiveAgentWorkload onExplore={setExplorerRequest} />
        </>
      ) : null}

      <SupportAnalyticsTicketExplorerModal request={explorerRequest} onClose={() => setExplorerRequest(null)} />

      {syncRun.data?.run ? (
        <p className="text-xs text-muted-foreground">
          Sync: {syncRun.data.run.status} — {syncRun.data.run.message}
        </p>
      ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
