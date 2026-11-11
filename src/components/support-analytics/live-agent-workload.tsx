import { useQuery } from "@tanstack/react-query";
import { SectionHeader, LoadingBlock, ErrorBlock } from "@/components/bits";
import { formatNumber } from "@/lib/format";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-client";
import type {
  SupportAnalyticsTicketExplorerRequest,
  TicketExplorerFilterTab,
} from "@/components/support-analytics/ticket-explorer-modal";
import {
  agentFreshdeskIdParam,
  buildWorkloadFilterTabs,
  type LiveWorkloadCounts,
  type LiveWorkloadMetricKey,
  workloadMetricTabKey,
} from "@/components/support-analytics/live-workload-shared";
import type { AgentPresencePublic } from "@/components/support-analytics/agent-presence-display";
import { AgentPresenceBlock } from "@/components/support-analytics/agent-presence-ui";

type LiveAgentRow = LiveWorkloadCounts & {
  agentFreshdeskId: number | null;
  agentName: string;
  presence?: AgentPresencePublic;
};

type LiveAgentWorkload = {
  lastSuccessfulTicketSyncAt: string | null;
  note: string;
  totals: LiveWorkloadCounts & { unassignedBacklog: number };
  unassignedBacklogOpen: number;
  agents: LiveAgentRow[];
};

type AgentMetricTab = LiveWorkloadMetricKey;

function agentFilterTabs(agent: LiveAgentRow): TicketExplorerFilterTab[] {
  const responder = agentFreshdeskIdParam(agent.agentFreshdeskId);
  return buildWorkloadFilterTabs(agent, { responderFreshdeskId: responder, limit: "500" });
}

export function SupportAnalyticsLiveAgentWorkload({
  onExplore,
}: {
  onExplore: (req: SupportAnalyticsTicketExplorerRequest) => void;
}) {
  const workload = useQuery({
    queryKey: ["support-analytics", "live-agents", "list"],
    queryFn: () => api<LiveAgentWorkload>("/api/support-analytics/live/agents"),
    staleTime: STALE.operational,
  });

  const data = workload.data;
  const maxBacklog = Math.max(1, ...(data?.agents.map((a) => a.backlog) ?? [1]));

  function openAgentExplorer(agent: LiveAgentRow, initialMetric: AgentMetricTab) {
    const tabs = agentFilterTabs(agent);
    const initialTabKey = workloadMetricTabKey(initialMetric);
    const tab = tabs.find((t) => t.key === initialTabKey) ?? tabs[0];
    onExplore({
      source: "live",
      title: agent.agentName,
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="text-left text-sm font-medium hover:underline"
                        onClick={() => openAgentExplorer(a, "backlog")}
                      >
                        {a.agentName}
                        <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                          {formatNumber(a.backlog)} backlog
                        </span>
                      </button>
                      <AgentPresenceBlock presence={a.presence} />
                    </div>
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
    </section>
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
