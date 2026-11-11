import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorBlock, LoadingBlock, PageHeader, SectionHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { STALE } from "@/lib/query-client";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SupportAnalyticsHistoricalPanel } from "@/pages/support-analytics-historical-panel";
import { SupportAnalyticsLiveAgentWorkload } from "@/components/support-analytics/live-agent-workload";
import { SupportAnalyticsLiveGroupWorkload } from "@/components/support-analytics/live-group-workload";
import { LIVE_WORKLOAD_EXPLORER_NOTES } from "@/components/support-analytics/live-workload-shared";
import { SupportAnalyticsSchedulerStatusPanel } from "@/components/support-analytics/scheduler-status-panel";
import { LiveBacklogMetricCard } from "@/components/support-analytics/live-metric-card";
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
  const description = row.description?.trim() ? row.description : fallback.description;
  return {
    label: row.label?.trim() ? row.label : fallback.label,
    description,
    kind: row.kind?.trim() ? row.kind : fallback.kind,
    notes: fallback.notes ?? row.notes,
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
  const { can, canMutate, readOnly } = useAuth();
  const qc = useQueryClient();
  const [explorerRequest, setExplorerRequest] = useState<SupportAnalyticsTicketExplorerRequest | null>(null);
  const [mainTab, setMainTab] = useState<"live" | "historical">("live");
  const [syncDetailsOpen, setSyncDetailsOpen] = useState(false);

  const overview = useQuery({
    queryKey: ["support-analytics", "overview"],
    queryFn: () => api<OverviewPayload>("/api/support-analytics/overview"),
    staleTime: STALE.operational,
  });

  const data = overview.data;

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

  function openLiveTickets(title: string, kind: string, extra: Record<string, string> = {}) {
    setExplorerRequest({
      source: "live",
      title,
      exportFileName: `live-${kind}.csv`,
      queryParams: { kind, limit: "500", ...extra },
    });
  }

  const canSync = canMutate("support_analytics.sync");
  const syncPreviewInViewAs = readOnly && can("support_analytics.sync") && mainTab === "live";
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
          canSync || syncPreviewInViewAs || showSyncHistory ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canSync ? (
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
              {syncPreviewInViewAs ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 min-w-[8.5rem] px-4"
                  disabled
                  title="View As is read-only. Exit View As (or sign in as this user) to run Freshdesk sync."
                >
                  Sync Freshdesk
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
                      notes: LIVE_WORKLOAD_EXPLORER_NOTES,
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
