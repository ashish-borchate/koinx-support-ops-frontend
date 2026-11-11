import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionHeader, LoadingBlock, ErrorBlock } from "@/components/bits";
import { formatNumber } from "@/lib/format";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-client";
import type { SupportAnalyticsTicketExplorerRequest } from "@/components/support-analytics/ticket-explorer-modal";
import { sortLiveGroupRows } from "@/components/support-analytics/live-group-display";
import {
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
    exportFileName: `live-group-${groupParam}.csv`,
    filterTabs: tabs,
    initialTabKey: tab?.key ?? "backlog",
    queryParams: tab?.queryParams ?? { kind: "backlog", ...base },
    initialGroupFreshdeskId: groupParam,
  });
}

function groupActivityDot(counts: LiveWorkloadCounts): "green" | "red" | null {
  if (counts.statusOpen > 0 || counts.waitingOnCustomer > 0) return "green";
  if (counts.overdueResolution > 0 && counts.backlog > 0) return "red";
  return null;
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
  const displayGroups = useMemo(
    () => (data ? sortLiveGroupRows(data.groups) : []),
    [data],
  );

  return (
    <section className="space-y-3">
      <SectionHeader title="Current Group Workload" />

      {workload.isLoading ? <LoadingBlock label="Loading group workload…" /> : null}
      {workload.isError ? <ErrorBlock message="Could not load live group workload." /> : null}

      {data ? (
        <>
          {displayGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Freshdesk groups in the Live store yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-[11px] text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Group</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Backlog</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Open</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Waiting on Customer</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {displayGroups.map((g) => {
                    const dot = groupActivityDot(g);
                    return (
                      <tr key={String(g.groupFreshdeskId)} className="border-b border-border/60 last:border-0">
                        <td className="max-w-[14rem] px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              className="min-w-0 truncate text-left font-medium hover:underline"
                              title={g.groupName}
                              onClick={() => openGroupExplorer(onExplore, g, "backlog")}
                            >
                              {g.groupName}
                            </button>
                            {dot ? (
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  dot === "green" ? "bg-emerald-500" : "bg-red-500"
                                }`}
                                title={
                                  dot === "green"
                                    ? "Open or waiting tickets in this group"
                                    : "Overdue resolution SLA in this group"
                                }
                                aria-hidden
                              />
                            ) : (
                              <span className="w-2 shrink-0" aria-hidden />
                            )}
                          </div>
                        </td>
                        <MetricCells counts={g} onMetric={(m) => openGroupExplorer(onExplore, g, m)} />
                      </tr>
                    );
                  })}
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
      <MetricCell value={counts.waitingOnCustomer} onClick={() => onMetric("waiting")} />
      <MetricCell value={counts.overdueResolution} onClick={() => onMetric("overdue")} tone="warn" />
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
    <td className="px-2 py-2 text-right whitespace-nowrap">
      <button
        type="button"
        disabled={value === 0}
        onClick={onClick}
        className={`tabular-nums hover:underline disabled:cursor-default disabled:no-underline ${
          tone === "warn" ? "text-amber-800 dark:text-amber-300" : ""
        }`}
      >
        {formatNumber(value)}
      </button>
    </td>
  );
}
