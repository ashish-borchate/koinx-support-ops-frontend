import { useQuery } from "@tanstack/react-query";
import { SectionHeader, LoadingBlock, ErrorBlock } from "@/components/bits";
import { formatNumber } from "@/lib/format";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-client";
import type { SupportAnalyticsTicketExplorerRequest } from "@/components/support-analytics/ticket-explorer-modal";
import {
  backlogExplorerSubtitle,
  buildWorkloadFilterTabs,
  groupFreshdeskIdParam,
  type LiveWorkloadCounts,
  type LiveWorkloadMetricKey,
  workloadMetricTabKey,
} from "@/components/support-analytics/live-workload-shared";

type LiveGroupRow = LiveWorkloadCounts & {
  groupFreshdeskId: number | null;
  groupName: string;
};

type LiveGroupWorkload = {
  lastSuccessfulTicketSyncAt: string | null;
  note: string;
  totals: LiveWorkloadCounts & { unassignedGroupBacklog: number };
  unassignedGroupBacklog: number;
  groups: LiveGroupRow[];
};

function openGroupExplorer(
  onExplore: (req: SupportAnalyticsTicketExplorerRequest) => void,
  group: LiveGroupRow,
  metric: LiveWorkloadMetricKey,
) {
  const groupParam = groupFreshdeskIdParam(group.groupFreshdeskId);
  const base = { groupFreshdeskId: groupParam, limit: "500" };
  const tabs = buildWorkloadFilterTabs(group, base);
  const initialTabKey = workloadMetricTabKey(metric);
  const tab = tabs.find((t) => t.key === initialTabKey) ?? tabs[0];

  onExplore({
    source: "live",
    title: group.groupName,
    subtitle: backlogExplorerSubtitle(group.backlog, "Live sync · by group"),
    exportFileName: `live-group-${groupParam}.csv`,
    filterTabs: tabs,
    initialTabKey: tab?.key ?? "backlog",
    queryParams: tab?.queryParams ?? { kind: "backlog", ...base },
    initialGroupFreshdeskId: groupParam,
  });
}

function openTotalsExplorer(
  onExplore: (req: SupportAnalyticsTicketExplorerRequest) => void,
  totals: LiveWorkloadCounts,
  metric: LiveWorkloadMetricKey,
) {
  const base = { limit: "500" };
  const tabs = buildWorkloadFilterTabs(totals, base);
  const initialTabKey = workloadMetricTabKey(metric);
  const tab = tabs.find((t) => t.key === initialTabKey) ?? tabs[0];

  onExplore({
    source: "live",
    title: "All groups",
    subtitle: backlogExplorerSubtitle(totals.backlog, "Live sync · total backlog"),
    exportFileName: "live-groups-total.csv",
    filterTabs: tabs,
    initialTabKey: tab?.key ?? "backlog",
    queryParams: tab?.queryParams ?? { kind: "backlog", ...base },
    initialGroupFreshdeskId: "all",
  });
}

export function SupportAnalyticsLiveGroupWorkload({
  onExplore,
}: {
  onExplore: (req: SupportAnalyticsTicketExplorerRequest) => void;
}) {
  const workload = useQuery({
    queryKey: ["support-analytics", "live-groups"],
    queryFn: () => api<LiveGroupWorkload>("/api/support-analytics/live/groups"),
    staleTime: STALE.operational,
  });

  const data = workload.data;

  return (
    <section className="space-y-3">
      <SectionHeader title="Current Group Workload" />

      {workload.isLoading ? <LoadingBlock label="Loading group workload…" /> : null}
      {workload.isError ? <ErrorBlock message="Could not load live group workload." /> : null}

      {data ? (
        <>
          {data.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No backlog tickets in the Live store.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="min-w-[52rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Group</th>
                    <th className="px-2 py-2 font-medium text-right">Backlog</th>
                    <th className="px-2 py-2 font-medium text-right">Open</th>
                    <th className="px-2 py-2 font-medium text-right">Pending</th>
                    <th className="px-2 py-2 font-medium text-right">Waiting</th>
                    <th className="px-2 py-2 font-medium text-right">AI</th>
                    <th className="px-2 py-2 font-medium text-right">Overdue</th>
                    <th className="px-2 py-2 font-medium text-right">High/Urg</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border bg-muted/20 font-medium">
                    <td className="px-3 py-2">All groups (total)</td>
                    <MetricCells
                      counts={data.totals}
                      onMetric={(m) => openTotalsExplorer(onExplore, data.totals, m)}
                    />
                  </tr>
                  {data.groups.map((g) => (
                    <tr key={String(g.groupFreshdeskId)} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left font-medium hover:underline"
                          onClick={() => openGroupExplorer(onExplore, g, "backlog")}
                        >
                          {g.groupName}
                        </button>
                      </td>
                      <MetricCells counts={g} onMetric={(m) => openGroupExplorer(onExplore, g, m)} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.note ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer list-none underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
                Coverage note
              </summary>
              <p className="mt-1 leading-relaxed">{data.note}</p>
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function MetricCells({
  counts,
  onMetric,
}: {
  counts: LiveWorkloadCounts;
  onMetric: (metric: LiveWorkloadMetricKey) => void;
}) {
  return (
    <>
      <MetricCell value={counts.backlog} onClick={() => onMetric("backlog")} />
      <MetricCell value={counts.statusOpen} onClick={() => onMetric("open")} />
      <MetricCell value={counts.pending} onClick={() => onMetric("pending")} />
      <MetricCell value={counts.waitingOnCustomer} onClick={() => onMetric("waiting")} />
      <MetricCell value={counts.assignedToAi} onClick={() => onMetric("assigned_to_ai")} />
      <MetricCell value={counts.overdueResolution} onClick={() => onMetric("overdue")} tone="warn" />
      <MetricCell value={counts.highUrgentPriority} onClick={() => onMetric("high_urgent")} />
    </>
  );
}

function MetricCell({
  value,
  onClick,
  tone,
}: {
  value: number;
  onClick: () => void;
  tone?: "warn";
}) {
  return (
    <td className="px-2 py-2 text-right">
      <button
        type="button"
        disabled={value === 0}
        onClick={onClick}
        className={`tabular-nums hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline ${
          tone === "warn" && value > 0 ? "text-amber-800 dark:text-amber-300" : ""
        }`}
      >
        {formatNumber(value)}
      </button>
    </td>
  );
}
