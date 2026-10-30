import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorBlock, LoadingBlock } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  formatComparePeriodLabel,
  formatNumber,
  historicalMonthKeys,
  historicalWeekStarts,
  previousPeriodKey,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { STALE } from "@/lib/query-client";

type CompareScope = "team" | "agent";

type CompareScorecard = {
  compositeScore: number | null;
  compositeDisplay: string;
  scoringConfigured: boolean;
  metrics: {
    id: string;
    label: string;
    direction: "higher" | "lower";
    actual: number | null;
    actualLabel: string;
  }[];
};

export type CompareResponse = {
  periodType: "weekly" | "monthly";
  scope: CompareScope;
  agent: { id: string; name: string } | null;
  periodA: {
    key: string;
    label: string;
    partial: boolean;
    scoring: { configurationLabel: string | null; versionId: string | null };
  };
  periodB: {
    key: string;
    label: string;
    partial: boolean;
    scoring: { configurationLabel: string | null; versionId: string | null };
  };
  scoringRulesChanged: boolean;
  limitations: string[];
  scorecardA: CompareScorecard | null;
  scorecardB: CompareScorecard | null;
  delta: { overall: number | null; metrics: Record<string, number> };
  defaultPeriodB: string;
  agents: { id: string; name: string }[];
};

type MetricRowDef = {
  id: "overall" | "qa" | "csat" | "sla" | "frt" | "art" | "resolution";
  label: string;
  direction: "higher" | "lower";
};

const METRIC_ROWS: MetricRowDef[] = [
  { id: "overall", label: "Overall KPI", direction: "higher" },
  { id: "qa", label: "QA", direction: "higher" },
  { id: "csat", label: "CSAT", direction: "higher" },
  { id: "sla", label: "SLA Compliance", direction: "higher" },
  { id: "frt", label: "First Response Time", direction: "lower" },
  { id: "art", label: "Average Response Time", direction: "lower" },
  { id: "resolution", label: "Resolution Time", direction: "lower" },
];

function changeSuffix(id: MetricRowDef["id"]) {
  if (id === "overall" || id === "qa") return " pts";
  if (id === "csat" || id === "sla") return " pp";
  return " h";
}

function formatChange(value: number | null, id: MetricRowDef["id"]) {
  if (value == null) return "—";
  if (value === 0) return `0${changeSuffix(id)}`;
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1)}${changeSuffix(id)}`;
}

function trendTone(
  delta: number | null,
  direction: "higher" | "lower",
  neutralOverall?: boolean,
): "good" | "bad" | "neutral" {
  if (neutralOverall || delta == null || delta === 0) return "neutral";
  const improved = direction === "higher" ? delta > 0 : delta < 0;
  return improved ? "good" : "bad";
}

function TrendIcon({ tone }: { tone: "good" | "bad" | "neutral" }) {
  if (tone === "good") return <ArrowUp className="size-3.5 shrink-0" aria-hidden />;
  if (tone === "bad") return <ArrowDown className="size-3.5 shrink-0" aria-hidden />;
  return <Minus className="size-3.5 shrink-0 opacity-60" aria-hidden />;
}

function valueForPeriod(scorecard: CompareScorecard | null, id: MetricRowDef["id"]) {
  if (!scorecard) return "—";
  if (id === "overall") return scorecard.compositeDisplay || "—";
  const m = scorecard.metrics.find((x) => x.id === id);
  return m?.actualLabel ?? "—";
}

function deltaForRow(data: CompareResponse, id: MetricRowDef["id"]) {
  if (id === "overall") return data.delta.overall;
  return data.delta.metrics[id] ?? null;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodType: "weekly" | "monthly";
  periodAKey: string;
  agents: { id: string; name: string }[];
};

export function ManagementCompareDialog({ open, onOpenChange, periodType, periodAKey, agents }: Props) {
  const [scope, setScope] = useState<CompareScope>("team");
  const [periodB, setPeriodB] = useState(() => previousPeriodKey(periodType, periodAKey));
  const [agentId, setAgentId] = useState("");

  useEffect(() => {
    if (!open) return;
    setPeriodB(previousPeriodKey(periodType, periodAKey));
    setScope("team");
  }, [open, periodType, periodAKey]);

  useEffect(() => {
    if (agents.length && !agentId) setAgentId(agents[0]?.id ?? "");
    if (agents.length && agentId && !agents.some((a) => a.id === agentId)) {
      setAgentId(agents[0]?.id ?? "");
    }
  }, [agents, agentId]);

  const periodOptions = useMemo(
    () => (periodType === "weekly" ? historicalWeekStarts(52) : historicalMonthKeys(36)),
    [periodType],
  );

  const query = useQuery({
    queryKey: ["management-compare", periodType, periodAKey, periodB, scope, scope === "agent" ? agentId : "team"],
    enabled: open && Boolean(periodAKey) && Boolean(periodB) && (scope === "team" || Boolean(agentId)),
    staleTime: STALE.operational,
    queryFn: () => {
      const params = new URLSearchParams({
        periodType,
        periodA: periodAKey,
        periodB,
        scope,
      });
      if (scope === "agent" && agentId) params.set("agentId", agentId);
      return api<CompareResponse>(`/api/management-overview/compare?${params.toString()}`);
    },
  });

  const formatPeriodOption = (key: string) => formatComparePeriodLabel(periodType, key);

  const periodBoxClass =
    "flex min-h-[4.25rem] flex-col justify-center rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,780px)] w-[min(96vw,52rem)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(94vw,52rem)]">
        <DialogHeader className="space-y-3 border-b border-border/60 px-4 py-4 sm:px-6">
          <DialogTitle className="text-left text-lg">Compare Results</DialogTitle>
          <div className="grid gap-3 sm:grid-cols-2 sm:items-stretch">
            <div className="space-y-1.5 sm:max-w-none">
              <Label className="text-xs text-muted-foreground">Scope</Label>
              <div className="inline-flex w-full max-w-[14rem] rounded-lg border border-border bg-muted/30 p-0.5 sm:w-full">
                <Button
                  type="button"
                  size="sm"
                  variant={scope === "team" ? "secondary" : "ghost"}
                  className="h-8 min-w-0 flex-1"
                  onClick={() => setScope("team")}
                >
                  Team
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={scope === "agent" ? "secondary" : "ghost"}
                  className="h-8 min-w-0 flex-1"
                  onClick={() => setScope("agent")}
                >
                  Agent
                </Button>
              </div>
            </div>
            {scope === "agent" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Agent</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger className="h-[2.125rem] w-full max-w-[14rem] bg-card sm:max-w-none">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="hidden sm:block" aria-hidden />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={periodBoxClass}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Period A</p>
              <p className="mt-1 text-sm font-medium leading-snug text-foreground">
                {formatPeriodOption(periodAKey)}
              </p>
              {query.data?.periodA.partial ? (
                <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">In progress</p>
              ) : null}
            </div>
            <div className={cn(periodBoxClass, "gap-0 py-2")}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Period B</p>
              <Select value={periodB} onValueChange={setPeriodB}>
                <SelectTrigger className="mt-1 h-auto w-full border-0 bg-transparent p-0 text-left text-sm font-medium leading-snug shadow-none focus:ring-0 [&>svg]:ml-auto [&>svg]:opacity-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[min(20rem,50vh)]">
                  {periodOptions
                    .filter((key) => key !== periodAKey)
                    .map((key) => (
                      <SelectItem key={key} value={key}>
                        {formatPeriodOption(key)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {query.data?.periodB.partial ? (
                <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">In progress</p>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {query.isPending ? <LoadingBlock /> : null}
          {query.isError ? <ErrorBlock message={query.error.message} /> : null}
          {query.data ? (
            <CompareBody data={query.data} scope={scope} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompareBody({ data, scope }: { data: CompareResponse; scope: CompareScope }) {
  const noData = !data.scorecardA && !data.scorecardB;
  const scoringBanner = data.scoringRulesChanged;

  return (
    <div className="space-y-4">
      {scope === "agent" && data.agent ? (
        <p className="text-xs text-muted-foreground">
          Comparing <span className="font-medium text-foreground">{data.agent.name}</span>
        </p>
      ) : null}

      {scoringBanner ? (
        <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          Scoring rules changed between periods. Individual metric values use each period&apos;s configuration; overall
          KPI change is shown without a performance verdict.
        </p>
      ) : null}

      {noData ? (
        <p className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          No KPI scorecard data for the selected scope and periods.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60 [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[36rem] table-fixed text-sm">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border/60 bg-muted/25 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Metric</th>
                <th className="px-3 py-2.5 font-medium text-right">Period A</th>
                <th className="px-3 py-2.5 font-medium text-right">Period B</th>
                <th className="px-4 py-2.5 font-medium text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map((row) => {
                const delta = deltaForRow(data, row.id);
                const neutralOverall = row.id === "overall" && data.scoringRulesChanged;
                const tone = trendTone(delta, row.direction, neutralOverall);
                return (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 font-medium leading-snug text-foreground">{row.label}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-foreground">
                      {valueForPeriod(data.scorecardA, row.id)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {valueForPeriod(data.scorecardB, row.id)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center justify-end gap-1 tabular-nums text-xs font-semibold sm:text-sm",
                          tone === "good" && "text-emerald-700 dark:text-emerald-400",
                          tone === "bad" && "text-rose-700 dark:text-rose-400",
                          tone === "neutral" && "text-muted-foreground",
                        )}
                      >
                        <TrendIcon tone={tone} />
                        {formatChange(delta, row.id)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.limitations.length ? (
        <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          {data.limitations.map((note) => (
            <li key={note} className="pl-0.5">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
