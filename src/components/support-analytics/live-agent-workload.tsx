import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionHeader, LoadingBlock, ErrorBlock } from "@/components/bits";
import { formatNumber } from "@/lib/format";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-client";
import { cn } from "@/lib/utils";
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
import {
  formatAgentPresenceCardSubtitle,
  presenceCardClassName,
  presenceCardSubtitleClassName,
  presenceStaleTitle,
} from "@/components/support-analytics/agent-presence-display";

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

/** Freshdesk roster names excluded from the live workload grid (product request). */
const EXCLUDED_AGENT_MATCHERS = [
  "karan tolani",
  "punit agarwal",
  "harshil",
  "guna",
  "rony",
  "siddant",
  "siddhant",
] as const;

function isExcludedAgentName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return EXCLUDED_AGENT_MATCHERS.some(
    (part) => normalized === part || normalized.includes(part),
  );
}

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

  const agents = useMemo(() => {
    if (!data?.agents) return [];
    return data.agents.filter((a) => !isExcludedAgentName(a.agentName));
  }, [data?.agents]);

  function openAgentExplorer(agent: LiveAgentRow, initialMetric: AgentMetricTab = "backlog") {
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
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents to display.</p>
          ) : (
            <AgentCardGrid>
              {agents.map((a) => (
                <AgentWorkloadCard key={String(a.agentFreshdeskId)} agent={a} onOpen={() => openAgentExplorer(a)} />
              ))}
            </AgentCardGrid>
          )}
          {data.note ? <CoverageNote note={data.note} /> : null}
        </>
      ) : null}
    </section>
  );
}

function AgentCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
  );
}

function AgentWorkloadCard({ agent, onOpen }: { agent: LiveAgentRow; onOpen: () => void }) {
  const presenceLine = formatAgentPresenceCardSubtitle(agent.presence);
  const stale = agent.presence?.stale ?? false;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={stale ? presenceStaleTitle(true) : undefined}
      className={cn(
        "flex h-full min-h-[6.5rem] flex-col rounded-xl border p-3 text-left shadow-sm transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        presenceCardClassName(agent.presence),
        stale && "ring-1 ring-dashed ring-muted-foreground/35",
      )}
    >
      <p className="text-sm font-semibold leading-snug">{agent.agentName}</p>
      {presenceLine ? (
        <p className={cn("mt-1 text-xs leading-snug", presenceCardSubtitleClassName(agent.presence))}>
          {presenceLine}
        </p>
      ) : null}
      <p className="mt-auto pt-2 text-xs font-normal tabular-nums text-foreground">
        <AgentMetricsInline agent={agent} />
      </p>
    </button>
  );
}

function AgentMetricsInline({ agent }: { agent: LiveAgentRow }) {
  const items: { label: string; value: number }[] = [
    { label: "Backlog", value: agent.backlog },
    { label: "Open", value: agent.statusOpen },
    { label: "Waiting", value: agent.waitingOnCustomer },
    { label: "Overdue", value: agent.overdueResolution },
  ];
  return (
    <>
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 ? <span className="mx-2 text-muted-foreground/50"> </span> : null}
          {item.label} {formatNumber(item.value)}
        </span>
      ))}
    </>
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
