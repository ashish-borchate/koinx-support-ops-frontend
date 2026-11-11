import type { TicketExplorerFilterTab } from "@/components/support-analytics/ticket-explorer-modal";

export type LiveWorkloadCounts = {
  backlog: number;
  statusOpen: number;
  waitingOnCustomer: number;
  pending: number;
  assignedToAi: number;
  overdueResolution: number;
  highUrgentPriority: number;
};

export type LiveWorkloadMetricKey =
  | "backlog"
  | "open"
  | "waiting"
  | "pending"
  | "assigned_to_ai"
  | "overdue"
  | "high_urgent";

export function groupFreshdeskIdParam(groupFreshdeskId: number | null): string {
  return groupFreshdeskId == null ? "0" : String(groupFreshdeskId);
}

export function agentFreshdeskIdParam(agentFreshdeskId: number | null): string {
  return agentFreshdeskId == null ? "0" : String(agentFreshdeskId);
}

export const LIVE_WORKLOAD_EXPLORER_NOTES =
  "Status tab counts match the group you opened from; badges are hidden after you change the group filter. The ticket list below reflects your current filters. Overdue overlaps Open and Waiting — tickets are not double-counted in backlog totals.";

export function buildWorkloadFilterTabs(
  counts: LiveWorkloadCounts,
  baseQuery: Record<string, string>,
): TicketExplorerFilterTab[] {
  return [
    {
      key: "backlog",
      label: "Backlog",
      count: counts.backlog,
      queryParams: { kind: "backlog", ...baseQuery },
    },
    {
      key: "open",
      label: "Open",
      count: counts.statusOpen,
      queryParams: { kind: "open", ...baseQuery },
    },
    {
      key: "waiting",
      label: "Waiting on customer",
      count: counts.waitingOnCustomer,
      queryParams: { kind: "waiting", ...baseQuery },
    },
    {
      key: "overdue",
      label: "Overdue",
      count: counts.overdueResolution,
      queryParams: { kind: "overdue_resolution", ...baseQuery },
    },
  ];
}

export function workloadMetricTabKey(metric: LiveWorkloadMetricKey): string {
  switch (metric) {
    case "backlog":
      return "backlog";
    case "open":
      return "open";
    case "waiting":
      return "waiting";
    case "pending":
      return "pending";
    case "assigned_to_ai":
      return "assigned_to_ai";
    case "overdue":
      return "overdue";
    case "high_urgent":
      return "high_urgent";
  }
}
