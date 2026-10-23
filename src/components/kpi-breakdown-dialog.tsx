import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorBlock, LoadingBlock } from "@/components/bits";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type KpiBreakdownRequest = {
  periodType: "weekly" | "monthly";
  week: string;
  month: string;
  scope: "team" | "agent";
  metric: string;
  agentId?: string;
};

type TeamMetricBreakdown = {
  kind: "team_metric";
  metricKey: string;
  metricName: string;
  directionLabel: string;
  periodLabel: string;
  configurationLabel: string | null;
  teamActual: string;
  targetLabel: string | null;
  weight: number;
  calculationMethod: string;
  formula: string;
  substituted: string | null;
  contributions: {
    agentName: string;
    metricValue: number | null;
    weightUsed: number;
  }[];
  qaAgentRows?: { agentName: string; reviewCount: number; averageDisplay: number }[];
  survey?: { positive: number; negative: number; neutral: number; totalAnswered: number; mode: string };
  limitation?: string;
};

type AgentMetricBreakdown = {
  kind: "agent_metric";
  metricName: string;
  agentName: string;
  directionLabel: string;
  periodLabel: string;
  configurationLabel: string | null;
  actualLabel: string;
  targetLabel: string | null;
  weight: number;
  scoring: {
    formula: string;
    substituted: string | null;
    note: string | null;
  };
  earnedDisplay: string;
};

type AgentOverallBreakdown = {
  kind: "agent_overall";
  agentName: string;
  periodLabel: string;
  configurationLabel: string | null;
  overallDisplay: string;
  statusMessage: string | null;
  reconciliationNote: string;
  metrics: AgentMetricBreakdown[];
};

type BreakdownPayload = TeamMetricBreakdown | AgentMetricBreakdown | AgentOverallBreakdown;

function breakdownSubtitle(periodLabel: string, configurationLabel: string | null, directionLabel?: string) {
  const parts = [periodLabel];
  if (configurationLabel) parts.push(configurationLabel);
  if (directionLabel) parts.push(directionLabel);
  return parts.join(" · ");
}

const TEAM_SCORE_COLUMN: Record<string, string> = {
  frt: "FRT Score",
  avgResponse: "ART Score",
  resolution: "Resolution Score",
  sla: "SLA Score",
  csat: "CSAT Score",
  qa: "QA Score",
};

function formatTeamAgentScore(metricKey: string, value: number | null): string {
  if (value == null) return "—";
  if (metricKey === "frt" || metricKey === "avgResponse" || metricKey === "resolution") {
    return `${formatNumber(value, 1)}h`;
  }
  if (metricKey === "sla" || metricKey === "csat") return `${formatNumber(value, 1)}%`;
  if (metricKey === "qa") return `${formatNumber(value, 1)}/100`;
  return String(value);
}

function StatBlock({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function KpiBreakdownDialog({
  request,
  open,
  onOpenChange,
}: {
  request: KpiBreakdownRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useQuery({
    queryKey: ["kpi-breakdown", request],
    queryFn: () => {
      if (!request) throw new Error("No request");
      const params = new URLSearchParams({
        periodType: request.periodType,
        scope: request.scope,
        metric: request.metric,
      });
      if (request.periodType === "monthly") params.set("month", request.month);
      else params.set("week", request.week);
      if (request.agentId) params.set("agentId", request.agentId);
      return api<{ breakdown: BreakdownPayload }>(`/api/kpi/breakdown?${params.toString()}`);
    },
    enabled: open && Boolean(request),
  });

  const data = query.data?.breakdown;

  const subtitle =
    data?.kind === "team_metric"
      ? breakdownSubtitle(data.periodLabel, data.configurationLabel, data.directionLabel)
      : data?.kind === "agent_metric"
        ? breakdownSubtitle(data.periodLabel, data.configurationLabel, data.directionLabel)
        : data?.kind === "agent_overall"
          ? breakdownSubtitle(data.periodLabel, data.configurationLabel)
          : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorBlock message={query.error.message} /> : null}
        {data ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">
                {data.kind === "team_metric"
                  ? `${data.metricName} · Team`
                  : data.kind === "agent_overall"
                    ? `Overall KPI · ${data.agentName}`
                    : `${data.metricName} · ${data.agentName}`}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </DialogHeader>
            {data.kind === "team_metric" ? <TeamBreakdownView data={data} /> : null}
            {data.kind === "agent_metric" ? <AgentMetricBreakdownView data={data} /> : null}
            {data.kind === "agent_overall" ? <AgentOverallBreakdownView data={data} /> : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TeamBreakdownView({ data }: { data: TeamMetricBreakdown }) {
  const scoreColumn = TEAM_SCORE_COLUMN[data.metricKey] ?? "Score";

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
        <StatBlock label="Team actual" value={data.teamActual} />
        <StatBlock label="Target" value={data.targetLabel ?? "Not configured"} className="text-center" />
        <StatBlock label="Metric weightage" value={String(data.weight)} className="text-right" />
      </div>
      <Section title="How this was calculated" body={data.calculationMethod} />
      <Section title="Formula" body={data.formula} mono />
      {data.substituted ? <Section title="With your data" body={data.substituted} mono /> : null}
      {data.survey && data.survey.mode === "survey_counts" ? (
        <div className="rounded-lg border border-border/50 p-3 text-xs">
          <p className="font-semibold text-foreground">Survey totals</p>
          <p className="mt-1 text-muted-foreground">
            Positive {data.survey.positive} · Negative {data.survey.negative} · Neutral {data.survey.neutral} · Total{" "}
            {data.survey.totalAnswered}
          </p>
        </div>
      ) : null}
      {data.qaAgentRows?.length ? (
        <AgentScoreTable
          scoreColumn={scoreColumn}
          rows={data.qaAgentRows.map((row) => ({
            agentName: row.agentName,
            score: `${row.averageDisplay}/100`,
          }))}
        />
      ) : null}
      {data.contributions.some((c) => c.weightUsed > 0) ? (
        <AgentScoreTable
          scoreColumn={scoreColumn}
          rows={data.contributions
            .filter((c) => c.weightUsed > 0)
            .map((row) => ({
              agentName: row.agentName,
              score: formatTeamAgentScore(data.metricKey, row.metricValue),
            }))}
        />
      ) : null}
      {data.limitation ? <p className="text-xs text-muted-foreground">{data.limitation}</p> : null}
    </div>
  );
}

function AgentScoreTable({ scoreColumn, rows }: { scoreColumn: string; rows: { agentName: string; score: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-xs">
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>
            <th className="px-2.5 py-2 text-left font-semibold">Agent</th>
            <th className="px-2.5 py-2 text-right font-semibold">{scoreColumn}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((row) => (
            <tr key={row.agentName}>
              <td className="px-2.5 py-2 font-medium text-foreground">{row.agentName}</td>
              <td className="px-2.5 py-2 text-right tabular-nums font-medium">{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentMetricBreakdownView({ data }: { data: AgentMetricBreakdown; nested?: boolean }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-4">
        <StatBlock label="Actual" value={data.actualLabel} />
        <StatBlock label="Target" value={data.targetLabel ?? "Not configured"} />
        <StatBlock label="Weight" value={String(data.weight)} />
        <StatBlock label="Earned" value={data.earnedDisplay} />
      </div>
      <Section title="Formula" body={data.scoring.formula} mono />
      {data.scoring.substituted ? <Section title="With your numbers" body={data.scoring.substituted} mono /> : null}
      {data.scoring.note ? <p className="text-xs text-amber-800 dark:text-amber-200">{data.scoring.note}</p> : null}
    </div>
  );
}

function AgentOverallBreakdownView({ data }: { data: AgentOverallBreakdown }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const totalWeight = data.metrics.reduce((s, m) => s + m.weight, 0);

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
        <span className="text-sm font-medium text-muted-foreground">Overall KPI score</span>
        <span className="text-base font-semibold tabular-nums">{data.overallDisplay}</span>
      </div>
      {data.statusMessage ? <p className="text-xs text-muted-foreground">{data.statusMessage}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-semibold">Metric</th>
              <th className="px-2 py-2 text-right font-semibold">Actual</th>
              <th className="px-2 py-2 text-right font-semibold">Target</th>
              <th className="px-2 py-2 text-right font-semibold">Weight</th>
              <th className="px-2 py-2 text-right font-semibold">Earned</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {data.metrics.map((m) => (
              <Fragment key={m.metricName}>
                <tr className="hover:bg-muted/20">
                  <td className="px-2 py-2 font-medium">{m.metricName}</td>
                  <td className="px-2 py-2 text-right">{m.actualLabel}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">{m.targetLabel ?? "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{m.weight}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium">{m.earnedDisplay}</td>
                  <td className="px-1 py-2">
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                      aria-expanded={expanded === m.metricName}
                      onClick={() => setExpanded((id) => (id === m.metricName ? null : m.metricName))}
                    >
                      <ChevronDown className={cn("size-4 transition-transform", expanded === m.metricName && "rotate-180")} />
                    </button>
                  </td>
                </tr>
                {expanded === m.metricName ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-2">
                      <div className="rounded-lg border-2 border-primary/60 bg-primary/5 px-3 py-3 ring-1 ring-primary/20">
                        <AgentMetricBreakdownView data={m} nested />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            <tr className="bg-muted/20 font-semibold">
              <td className="px-2 py-2">Overall</td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right tabular-nums">{totalWeight}</td>
              <td className="px-2 py-2 text-right tabular-nums">{data.overallDisplay}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{data.reconciliationNote}</p>
    </div>
  );
}

function Section({ title, body, mono }: { title: string; body: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className={cn("mt-1 text-xs text-muted-foreground", mono && "font-mono leading-relaxed")}>{body}</p>
    </div>
  );
}
