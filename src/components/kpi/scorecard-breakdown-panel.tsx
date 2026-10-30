import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { earnedPointsTone, kpiToneBorder, type KpiMetricTone } from "@/lib/kpi-metric-tone";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const toneBorder = kpiToneBorder;

export type ScorecardMetric = {
  id: string;
  label: string;
  actualLabel: string;
  target: number | null;
  weight: number;
  points: number | null;
  pointsDisplay: string;
};

export type ScorecardPanelData = {
  compositeDisplay?: string | null;
  metrics: ScorecardMetric[];
};

export type MetricBreakdownCardItem = {
  id: string;
  label: string;
  value: string;
  targetLabel: string;
  weight?: number;
  pointsDisplay?: string | null;
  tone?: KpiMetricTone;
};

function formatScorecardTarget(metric: ScorecardMetric): string {
  if (metric.target == null) return "not configured";
  const isPercent = metric.id === "sla" || metric.id === "csat" || metric.id === "qa";
  const suffix = isPercent ? "%" : "h";
  return `${formatNumber(metric.target, isPercent ? 0 : 1)}${suffix}`;
}

export function MetricBreakdownCardGrid({
  items,
  className,
}: {
  items: MetricBreakdownCardItem[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6", className)}>
      {items.map((item) => {
        const tone = item.tone ?? "neutral";
        return (
          <div key={item.id} className={cn("rounded-md border px-2.5 py-2", toneBorder[tone])}>
            <p className="text-[10px] font-semibold leading-snug text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{item.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Target {item.targetLabel}</p>
            {item.weight != null ? (
              <p className="mt-1 border-t border-border/40 pt-1 text-[10px] tabular-nums text-muted-foreground">
                Weight {item.weight}
                {item.pointsDisplay ? ` · Earned ${item.pointsDisplay}` : ""}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  scorecard: ScorecardPanelData | null;
  className?: string;
  footer?: ReactNode;
  emptyMessage?: string;
};

export function ScorecardBreakdownPanel({
  scorecard,
  className,
  footer,
  emptyMessage = "No KPI scorecard for this period.",
}: Props) {
  if (!scorecard?.metrics?.length) {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        {footer}
      </div>
    );
  }

  const cards: MetricBreakdownCardItem[] = scorecard.metrics.map((metric) => ({
    id: metric.id,
    label: metric.label,
    value: metric.actualLabel,
    targetLabel: formatScorecardTarget(metric),
    weight: metric.weight,
    pointsDisplay: metric.points != null ? metric.pointsDisplay : null,
    tone: metric.points != null ? earnedPointsTone(metric.points, metric.weight) : "neutral",
  }));

  return (
    <div className={className}>
      <p className="text-xs font-semibold text-foreground">Metric breakdown</p>
      <MetricBreakdownCardGrid items={cards} className="mt-2" />
      {scorecard.compositeDisplay ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Overall KPI: <span className="font-medium text-foreground">{scorecard.compositeDisplay}</span>
        </p>
      ) : null}
      {footer}
    </div>
  );
}

export function KpiPerformanceDeepLink({
  periodType,
  week,
  month,
  agentId,
  className,
}: {
  periodType: "weekly" | "monthly";
  week: string;
  month: string;
  agentId: string;
  className?: string;
}) {
  const params = new URLSearchParams({ periodType, agentId });
  if (periodType === "monthly") params.set("month", month);
  else params.set("week", week);
  return (
    <Link className={cn("mt-2 inline-block text-sm text-primary hover:underline", className)} to={`/kpi?${params.toString()}`}>
      Open in KPI Performance
    </Link>
  );
}
