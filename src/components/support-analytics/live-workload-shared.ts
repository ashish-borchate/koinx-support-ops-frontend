import { formatNumber } from "@/lib/format";
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

export function buildWorkloadFilterTabs(
  counts: LiveWorkloadCounts,
  baseQuery: Record<string, string>,
): TicketExplorerFilterTab[] {
  const tabs: TicketExplorerFilterTab[] = [
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
      label: "Waiting on Cust.",
      count: counts.waitingOnCustomer,
      queryParams: { kind: "waiting", ...baseQuery },
    },
    {
      key: "overdue",
      label: "Overdue",
      count: counts.overdueResolution,
      queryParams: { kind: "overdue_resolution", ...baseQuery },
      hint: "Resolution SLA overdue; may include Open or Waiting tickets.",
    },
    {
      key: "high_urgent",
      label: "High / urgent",
      count: counts.highUrgentPriority,
      queryParams: { kind: "high_urgent", ...baseQuery },
      hint: "Priority high or urgent; may include Open or Waiting tickets.",
    },
  ];

  if (counts.pending > 0) {
    tabs.splice(2, 0, {
      key: "pending",
      label: "Pending",
      count: counts.pending,
      queryParams: { kind: "pending", ...baseQuery },
    });
  }
  if (counts.assignedToAi > 0) {
    tabs.push({
      key: "assigned_to_ai",
      label: "Assigned to AI",
      count: counts.assignedToAi,
      queryParams: { kind: "assigned_to_ai", ...baseQuery },
    });
  }

  return tabs;
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

export function backlogExplorerSubtitle(backlog: number, context: string): string {
  return `${formatNumber(backlog)} backlog ticket${backlog === 1 ? "" : "s"} · ${context}`;
}
