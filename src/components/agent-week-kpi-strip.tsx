import { compareKpiTone, kpiToneBorder, type KpiMetricTone } from "@/lib/kpi-metric-tone";
import { formatNumber, type Metric } from "@/lib/format";
import { formatDurationHours } from "@/lib/format";
import { cn } from "@/lib/utils";

type Goals = {
  firstResponseHours: number;
  averageResponseHours: number;
  resolutionHours: number;
  csatPercent: number;
  slaPercent: number;
  qaPercent: number;
};

export type AgentWeekKpiStripPayload = {
  label: string;
  ticketsHandled: Metric | null;
  firstResponseHours: Metric | null;
  averageResponseHours: Metric | null;
  resolutionHours: Metric | null;
  csatPercent: Metric | null;
  slaPercent: Metric | null;
  qaScore: number | null;
};

function metricText(metric: Metric | null | undefined, suffix = "", digits = 1) {
  if (!metric || metric.value == null) return "—";
  return `${formatNumber(metric.value, digits)}${suffix}`;
}

/** Nullable API metric object → numeric value for tone/duration helpers. */
export function metricNumericValue(metric: Metric | null | undefined): number | null {
  if (!metric || metric.value == null) return null;
  return metric.value;
}

/** Pure item builder for rendering and regression tests. */
export function buildAgentWeekKpiStripItems(ownKpi: AgentWeekKpiStripPayload, goals: Goals) {
  const items: { key: string; label: string; value: string; tone: KpiMetricTone }[] = [
    { key: "tickets", label: "Tickets", value: metricText(ownKpi.ticketsHandled, "", 0), tone: "neutral" },
    {
      key: "frt",
      label: "FRT",
      value: formatDurationHours(metricNumericValue(ownKpi.firstResponseHours)),
      tone: compareKpiTone(metricNumericValue(ownKpi.firstResponseHours), goals.firstResponseHours, "lte"),
    },
    {
      key: "art",
      label: "ART",
      value: formatDurationHours(metricNumericValue(ownKpi.averageResponseHours)),
      tone: compareKpiTone(metricNumericValue(ownKpi.averageResponseHours), goals.averageResponseHours, "lte"),
    },
    {
      key: "res",
      label: "Res",
      value: formatDurationHours(metricNumericValue(ownKpi.resolutionHours)),
      tone: compareKpiTone(metricNumericValue(ownKpi.resolutionHours), goals.resolutionHours, "lte"),
    },
    {
      key: "sla",
      label: "SLA",
      value: metricText(ownKpi.slaPercent, "%"),
      tone: compareKpiTone(metricNumericValue(ownKpi.slaPercent), goals.slaPercent, "gte"),
    },
    {
      key: "csat",
      label: "CSAT",
      value: metricText(ownKpi.csatPercent, "%"),
      tone: compareKpiTone(metricNumericValue(ownKpi.csatPercent), goals.csatPercent, "gte"),
    },
    {
      key: "qa",
      label: "QA",
      value: ownKpi.qaScore == null ? "—" : `${formatNumber(ownKpi.qaScore, 1)}/100`,
      tone: compareKpiTone(ownKpi.qaScore, goals.qaPercent, "gte"),
    },
  ];
  return items;
}

export function AgentWeekKpiStrip({ ownKpi, goals }: { ownKpi: AgentWeekKpiStripPayload; goals: Goals }) {
  const items = buildAgentWeekKpiStripItems(ownKpi, goals);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            "flex min-h-[4.5rem] flex-col rounded-lg border px-2.5 py-2 shadow-[var(--shadow-card)]",
            kpiToneBorder[item.tone],
          )}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-base font-semibold tabular-nums leading-tight text-foreground sm:text-lg">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
