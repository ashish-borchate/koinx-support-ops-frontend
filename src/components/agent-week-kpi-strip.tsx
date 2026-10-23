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

type OwnKpi = {
  label: string;
  ticketsHandled: Metric;
  firstResponseHours: Metric;
  averageResponseHours: Metric;
  resolutionHours: Metric;
  csatPercent: Metric;
  slaPercent: Metric;
  qaScore: number | null;
};

function metricText(metric: Metric | undefined, suffix = "", digits = 1) {
  if (!metric || metric.value == null) return "—";
  return `${formatNumber(metric.value, digits)}${suffix}`;
}

export function AgentWeekKpiStrip({ ownKpi, goals }: { ownKpi: OwnKpi; goals: Goals }) {
  const items: { key: string; label: string; value: string; tone: KpiMetricTone }[] = [
    { key: "tickets", label: "Tickets", value: metricText(ownKpi.ticketsHandled, "", 0), tone: "neutral" },
    {
      key: "frt",
      label: "FRT",
      value: formatDurationHours(ownKpi.firstResponseHours.value),
      tone: compareKpiTone(ownKpi.firstResponseHours.value, goals.firstResponseHours, "lte"),
    },
    {
      key: "art",
      label: "ART",
      value: formatDurationHours(ownKpi.averageResponseHours.value),
      tone: compareKpiTone(ownKpi.averageResponseHours.value, goals.averageResponseHours, "lte"),
    },
    {
      key: "res",
      label: "Res",
      value: formatDurationHours(ownKpi.resolutionHours.value),
      tone: compareKpiTone(ownKpi.resolutionHours.value, goals.resolutionHours, "lte"),
    },
    {
      key: "sla",
      label: "SLA",
      value: metricText(ownKpi.slaPercent, "%"),
      tone: compareKpiTone(ownKpi.slaPercent.value, goals.slaPercent, "gte"),
    },
    {
      key: "csat",
      label: "CSAT",
      value: metricText(ownKpi.csatPercent, "%"),
      tone: compareKpiTone(ownKpi.csatPercent.value, goals.csatPercent, "gte"),
    },
    {
      key: "qa",
      label: "QA",
      value: ownKpi.qaScore == null ? "—" : `${formatNumber(ownKpi.qaScore, 1)}/100`,
      tone: compareKpiTone(ownKpi.qaScore, goals.qaPercent, "gte"),
    },
  ];

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
