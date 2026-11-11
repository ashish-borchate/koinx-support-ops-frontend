import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionHeader, LoadingBlock, ErrorBlock } from "@/components/bits";
import { formatNumber } from "@/lib/format";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type {
  SupportAnalyticsTicketExplorerRequest,
  TicketExplorerFilterTab,
} from "@/components/support-analytics/ticket-explorer-modal";
import {
  agentFreshdeskIdParam,
  backlogExplorerSubtitle,
  buildWorkloadFilterTabs,
  groupFreshdeskIdParam,
  type LiveWorkloadCounts,
  type LiveWorkloadMetricKey,
  workloadMetricTabKey,
} from "@/components/support-analytics/live-workload-shared";

type LiveAgentRow = LiveWorkloadCounts & {
  agentFreshdeskId: number | null;
  agentName: string;
};

type LiveAgentGroupRow = LiveWorkloadCounts & {
  groupFreshdeskId: number | null;
  groupName: string;
};

type LiveAgentWorkload = {
  lastSuccessfulTicketSyncAt: string | null;
  note: string;
  totals: LiveWorkloadCounts & { unassignedBacklog: number };
  unassignedBacklogOpen: number;
  agents: LiveAgentRow[];
  selectedAgent?: LiveAgentRow & { byGroup: LiveAgentGroupRow[] };
};

type AgentMetricTab = LiveWorkloadMetricKey;

function agentFilterTabs(agent: LiveAgentRow): TicketExplorerFilterTab[] {
  const responder = agentFreshdeskIdParam(agent.agentFreshdeskId);
  return buildWorkloadFilterTabs(agent, { responderFreshdeskId: responder, limit: "500" });
}

function agentGroupFilterTabs(
  agent: LiveAgentRow,
  group: LiveAgentGroupRow,
): TicketExplorerFilterTab[] {
  const responder = agentFreshdeskIdParam(agent.agentFreshdeskId);
  const groupParam = groupFreshdeskIdParam(group.groupFreshdeskId);
  return buildWorkloadFilterTabs(group, {
    responderFreshdeskId: responder,
    groupFreshdeskId: groupParam,
    limit: "500",
  });
}

export function SupportAnalyticsLiveAgentWorkload({
  onExplore,
}: {
  onExplore: (req: SupportAnalyticsTicketExplorerRequest) => void;
}) {
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>("all");

  const workload = useQuery({
    queryKey: ["support-analytics", "live-agents", selectedAgentKey === "all" ? "list" : selectedAgentKey],
    queryFn: () => {
      if (selectedAgentKey === "all") {
        return api<LiveAgentWorkload>("/api/support-analytics/live/agents");
      }
      return api<LiveAgentWorkload>(
        `/api/support-analytics/live/agents?agentFreshdeskId=${encodeURIComponent(selectedAgentKey)}`,
      );
    },
    staleTime: STALE.operational,
  });

  const data = workload.data;
  const maxBacklog = Math.max(1, ...(data?.agents.map((a) => a.backlog) ?? [1]));

  const agentOptions = useMemo(() => {
    const agents = data?.agents ?? [];
    const options = agents.map((a) => ({
      value: agentFreshdeskIdParam(a.agentFreshdeskId),
      label: a.agentName,
    }));
    if ((data?.unassignedBacklogOpen ?? data?.totals.unassignedBacklog ?? 0) > 0) {
      options.push({ value: "0", label: "Unassigned" });
    }
    return options;
  }, [data?.agents, data?.totals.unassignedBacklog, data?.unassignedBacklogOpen]);

  function openAgentExplorer(agent: LiveAgentRow, initialMetric: AgentMetricTab) {
    const tabs = agentFilterTabs(agent);
    const initialTabKey = workloadMetricTabKey(initialMetric);
    const tab = tabs.find((t) => t.key === initialTabKey) ?? tabs[0];
    onExplore({
      source: "live",
      title: agent.agentName,
      subtitle: backlogExplorerSubtitle(agent.backlog, "Live sync"),
      exportFileName: `live-agent-${agentFreshdeskIdParam(agent.agentFreshdeskId)}.csv`,
      filterTabs: tabs,
      initialTabKey: tab?.key ?? "backlog",
      queryParams:
        tab?.queryParams ?? {
          kind: "backlog",
          responderFreshdeskId: agentFreshdeskIdParam(agent.agentFreshdeskId),
          limit: "500",
        },
      initialGroupFreshdeskId: "all",
    });
  }

  function openAgentGroupExplorer(
    agent: LiveAgentRow,
    group: LiveAgentGroupRow,
    initialMetric: AgentMetricTab,
  ) {
    const groupParam = groupFreshdeskIdParam(group.groupFreshdeskId);
    const tabs = agentGroupFilterTabs(agent, group);
    const initialTabKey = workloadMetricTabKey(initialMetric);
    const tab = tabs.find((t) => t.key === initialTabKey) ?? tabs[0];
    onExplore({
      source: "live",
      title: `${agent.agentName} · ${group.groupName}`,
      subtitle: backlogExplorerSubtitle(group.backlog, "Live sync · agent by group"),
      exportFileName: `live-agent-${agentFreshdeskIdParam(agent.agentFreshdeskId)}-group-${groupParam}.csv`,
      filterTabs: tabs,
      initialTabKey: tab?.key ?? "backlog",
      queryParams:
        tab?.queryParams ?? {
          kind: "backlog",
          responderFreshdeskId: agentFreshdeskIdParam(agent.agentFreshdeskId),
          groupFreshdeskId: groupParam,
          limit: "500",
        },
      initialGroupFreshdeskId: groupParam,
    });
  }

  const selected = selectedAgentKey !== "all" ? data?.selectedAgent : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeader title="Current Agent Workload" />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="live-agent-select">
            View
          </label>
          <Select
            value={selectedAgentKey}
            onValueChange={setSelectedAgentKey}
            disabled={workload.isLoading && !data}
          >
            <SelectTrigger id="live-agent-select" className="h-9 w-[min(100%,14rem)]">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents (summary)</SelectItem>
              {agentOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAgentKey !== "all" ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedAgentKey("all")}>
              Back to all agents
            </Button>
          ) : null}
        </div>
      </div>

      {workload.isLoading ? <LoadingBlock label="Loading agent workload…" /> : null}
      {workload.isError ? <ErrorBlock message="Could not load live agent workload." /> : null}

      {data && selectedAgentKey === "all" ? (
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
                      <CountChip label="Open" value={a.statusOpen} onClick={() => openAgentExplorer(a, "open")} />
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
                  <AgentWorkloadBar agent={a} maxBacklog={maxBacklog} />
                </li>
              ))}
            </ul>
          )}
          {data.note ? <CoverageNote note={data.note} /> : null}
        </>
      ) : null}

      {data && selected ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{selected.agentName}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatNumber(selected.backlog)} backlog · Open {formatNumber(selected.statusOpen)} · Waiting{" "}
                {formatNumber(selected.waitingOnCustomer)}
              </p>
            </div>
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => openAgentExplorer(selected, "backlog")}>
              Open ticket explorer
            </Button>
          </div>

          {selected.byGroup.length === 0 ? (
            <p className="text-sm text-muted-foreground">No backlog tickets for this agent.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[48rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Group</th>
                    <th className="px-2 py-2 text-right font-medium">Backlog</th>
                    <th className="px-2 py-2 text-right font-medium">Open</th>
                    <th className="px-2 py-2 text-right font-medium">Pending</th>
                    <th className="px-2 py-2 text-right font-medium">Waiting</th>
                    <th className="px-2 py-2 text-right font-medium">AI</th>
                    <th className="px-2 py-2 text-right font-medium">Overdue</th>
                    <th className="px-2 py-2 text-right font-medium">High/Urg</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.byGroup.map((g) => (
                    <tr key={String(g.groupFreshdeskId)} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="font-medium hover:underline"
                          onClick={() => openAgentGroupExplorer(selected, g, "backlog")}
                        >
                          {g.groupName}
                        </button>
                      </td>
                      <GroupMetricCells
                        counts={g}
                        onMetric={(m) => openAgentGroupExplorer(selected, g, m)}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.note ? <CoverageNote note={data.note} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function GroupMetricCells({
  counts,
  onMetric,
}: {
  counts: LiveWorkloadCounts;
  onMetric: (metric: LiveWorkloadMetricKey) => void;
}) {
  const cells: { key: LiveWorkloadMetricKey; value: number; warn?: boolean }[] = [
    { key: "backlog", value: counts.backlog },
    { key: "open", value: counts.statusOpen },
    { key: "pending", value: counts.pending },
    { key: "waiting", value: counts.waitingOnCustomer },
    { key: "assigned_to_ai", value: counts.assignedToAi },
    { key: "overdue", value: counts.overdueResolution, warn: true },
    { key: "high_urgent", value: counts.highUrgentPriority },
  ];
  return (
    <>
      {cells.map((c) => (
        <td key={c.key} className="px-2 py-2 text-right">
          <button
            type="button"
            disabled={c.value === 0}
            onClick={() => onMetric(c.key)}
            className={`tabular-nums hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline ${
              c.warn && c.value > 0 ? "text-amber-800 dark:text-amber-300" : ""
            }`}
          >
            {formatNumber(c.value)}
          </button>
        </td>
      ))}
    </>
  );
}

function AgentWorkloadBar({ agent, maxBacklog }: { agent: LiveAgentRow; maxBacklog: number }) {
  return (
    <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-sky-500/80" style={{ width: `${(agent.statusOpen / maxBacklog) * 100}%` }} />
      <div
        className="h-full bg-violet-500/70"
        style={{ width: `${(agent.waitingOnCustomer / maxBacklog) * 100}%` }}
      />
      <div
        className="h-full bg-amber-500/90"
        style={{ width: `${Math.min(100, (agent.overdueResolution / maxBacklog) * 100)}%` }}
      />
    </div>
  );
}

function CoverageNote({ note }: { note: string }) {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer list-none underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
        Coverage note
      </summary>
      <p className="mt-1 leading-relaxed">{note}</p>
    </details>
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
