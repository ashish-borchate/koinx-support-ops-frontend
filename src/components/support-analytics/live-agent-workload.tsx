import { useQuery } from "@tanstack/react-query";
import { SectionHeader, LoadingBlock, ErrorBlock } from "@/components/bits";
import { formatNumber } from "@/lib/format";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-client";
import type {
  SupportAnalyticsTicketExplorerRequest,
  TicketExplorerFilterTab,
} from "@/components/support-analytics/ticket-explorer-modal";

type LiveWorkloadCounts = {
  backlog: number;
  statusOpen: number;
  waitingOnCustomer: number;
  pending: number;
  assignedToAi: number;
  overdueResolution: number;
  highUrgentPriority: number;
};

type LiveAgentRow = LiveWorkloadCounts & {
  agentFreshdeskId: number | null;
  agentName: string;
};

type LiveAgentWorkload = {
  lastSuccessfulTicketSyncAt: string | null;
  note: string;
  totals: LiveWorkloadCounts & { unassignedBacklog: number };
  agents: LiveAgentRow[];
};

type AgentMetricTab = "open" | "waiting" | "overdue" | "high_urgent" | "pending" | "assigned_to_ai";

function agentFilterTabs(agent: LiveAgentRow): TicketExplorerFilterTab[] {
  const responder = agent.agentFreshdeskId == null ? "0" : String(agent.agentFreshdeskId);
  const base = { responderFreshdeskId: responder, limit: "500" };

  const tabs: TicketExplorerFilterTab[] = [
    {
      key: "open",
      label: "Open",
      count: agent.statusOpen,
      queryParams: { kind: "open", ...base },
    },
    {
      key: "waiting",
      label: "Waiting on customer",
      count: agent.waitingOnCustomer,
      queryParams: { kind: "waiting", ...base },
    },
    {
      key: "overdue",
      label: "Overdue",
      count: agent.overdueResolution,
      queryParams: { kind: "overdue_resolution", ...base },
      hint: "Resolution SLA overdue; may include Open or Waiting tickets.",
    },
    {
      key: "high_urgent",
      label: "High / urgent",
      count: agent.highUrgentPriority,
      queryParams: { kind: "high_urgent", ...base },
      hint: "Priority high or urgent; may include Open or Waiting tickets.",
    },
  ];

  if (agent.pending > 0) {
    tabs.splice(2, 0, {
      key: "pending",
      label: "Pending",
      count: agent.pending,
      queryParams: { kind: "pending", ...base },
    });
  }
  if (agent.assignedToAi > 0) {
    tabs.push({
      key: "assigned_to_ai",
      label: "Assigned to AI",
      count: agent.assignedToAi,
      queryParams: { kind: "assigned_to_ai", ...base },
    });
  }

  return tabs;
}

function agentMetricTabKey(metric: AgentMetricTab): string {
  switch (metric) {
    case "open":
      return "open";
    case "waiting":
      return "waiting";
    case "overdue":
      return "overdue";
    case "high_urgent":
      return "high_urgent";
    case "pending":
      return "pending";
    case "assigned_to_ai":
      return "assigned_to_ai";
  }
}

export function SupportAnalyticsLiveAgentWorkload({
  onExplore,
}: {
  onExplore: (req: SupportAnalyticsTicketExplorerRequest) => void;
}) {
  const workload = useQuery({
    queryKey: ["support-analytics", "live-agents"],
    queryFn: () => api<LiveAgentWorkload>("/api/support-analytics/live/agents"),
    staleTime: STALE.operational,
  });

  const data = workload.data;
  const maxBacklog = Math.max(1, ...(data?.agents.map((a) => a.backlog) ?? [1]));

  function openAgentExplorer(agent: LiveAgentRow, initialMetric: AgentMetricTab) {
    const tabs = agentFilterTabs(agent);
    const initialTabKey = agentMetricTabKey(initialMetric);
    onExplore({
      source: "live",
      title: agent.agentName,
      subtitle: `${formatNumber(agent.backlog)} backlog ticket${agent.backlog === 1 ? "" : "s"} · Live sync`,
      exportFileName: `live-agent-${agent.agentFreshdeskId ?? "unassigned"}.csv`,
      filterTabs: tabs,
      initialTabKey,
      queryParams: tabs[0]?.queryParams ?? { kind: "backlog", limit: "500" },
    });
  }

  return (
    <section className="space-y-3">
      <SectionHeader title="Current Agent Workload" />

      {workload.isLoading ? <LoadingBlock label="Loading agent workload…" /> : null}
      {workload.isError ? <ErrorBlock message="Could not load live agent workload." /> : null}

      {data ? (
        <>
          {data.agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assigned backlog tickets in the Live store.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {data.agents.map((a) => (
                <li key={String(a.agentFreshdeskId)} className="px-3 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      className="text-left text-sm font-medium hover:underline"
                      onClick={() => openAgentExplorer(a, "open")}
                    >
                      {a.agentName}
                      <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                        {formatNumber(a.backlog)} backlog
                      </span>
                    </button>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <CountChip
                        label="Open"
                        value={a.statusOpen}
                        onClick={() => openAgentExplorer(a, "open")}
                      />
                      <CountChip
                        label="Waiting"
                        value={a.waitingOnCustomer}
                        onClick={() => openAgentExplorer(a, "waiting")}
                      />
                      <CountChip
                        label="Overdue"
                        value={a.overdueResolution}
                        tone="warn"
                        onClick={() => openAgentExplorer(a, "overdue")}
                      />
                      <CountChip
                        label="High/urgent"
                        value={a.highUrgentPriority}
                        onClick={() => openAgentExplorer(a, "high_urgent")}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-sky-500/80"
                      style={{ width: `${(a.statusOpen / maxBacklog) * 100}%` }}
                    />
                    <div
                      className="h-full bg-violet-500/70"
                      style={{ width: `${(a.waitingOnCustomer / maxBacklog) * 100}%` }}
                    />
                    <div
                      className="h-full bg-amber-500/90"
                      style={{ width: `${Math.min(100, (a.overdueResolution / maxBacklog) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
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

function CountChip({
  label,
  value,
  onClick,
  tone,
}: {
  label: string;
  value: number;
  onClick: () => void;
  tone?: "warn";
}) {
  return (
    <button
      type="button"
      disabled={value === 0}
      onClick={onClick}
      className={`rounded-md border px-2 py-0.5 tabular-nums transition hover:border-primary/50 disabled:opacity-50 ${
        tone === "warn" ? "border-amber-500/40 text-amber-800 dark:text-amber-300" : "border-border"
      }`}
    >
      {label} {formatNumber(value)}
    </button>
  );
}
