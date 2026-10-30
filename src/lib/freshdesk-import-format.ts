import { formatNumber } from "@/lib/format";
import { formatKpiImportDurationHours } from "@/lib/kpi-duration";

export type FreshdeskMetricValue = {
  value: number | null;
  noData: boolean;
  raw?: string;
};

export type FreshdeskAgentMetricsPayload = {
  sourceName: string;
  normalizedName: string;
  excluded: boolean;
  activity: {
    ticketsAssigned: FreshdeskMetricValue;
    ticketsResolved: FreshdeskMetricValue;
    ticketsReopened: FreshdeskMetricValue;
    ticketsReassignedFromAgent: FreshdeskMetricValue;
    privateNotes: FreshdeskMetricValue;
    responses: FreshdeskMetricValue;
  };
  time: {
    firstResponseSeconds: FreshdeskMetricValue;
    averageResponseSeconds: FreshdeskMetricValue;
    resolutionSeconds: FreshdeskMetricValue;
  };
  sla: {
    resolutionSlaPercent: FreshdeskMetricValue;
    firstResponseSlaPercent: FreshdeskMetricValue;
    fcrPercent: FreshdeskMetricValue;
  };
  csat: {
    positive: FreshdeskMetricValue;
    negative: FreshdeskMetricValue;
    neutral: FreshdeskMetricValue;
    total: FreshdeskMetricValue;
  };
};

export function formatFreshdeskCount(metric: FreshdeskMetricValue): string {
  if (metric.noData || metric.value == null) return "—";
  return formatNumber(metric.value, 0);
}

export function formatFreshdeskPercent(metric: FreshdeskMetricValue): string {
  if (metric.noData || metric.value == null) return "—";
  const v = metric.value;
  if (Number.isInteger(v) || Math.abs(v - Math.round(v)) < 0.0001) {
    return `${Math.round(v)}%`;
  }
  return `${formatNumber(v, 2)}%`;
}

/** PDF Time section values are stored as seconds (may include fractional ms). */
export function formatFreshdeskTimeSeconds(metric: FreshdeskMetricValue): string {
  if (metric.noData || metric.value == null) return "—";
  return formatKpiImportDurationHours(metric.value / 3600);
}

const KPI_DURATION_FIELDS = new Set(["firstResponseHours", "averageResponseHours", "resolutionHours"]);

export function formatKpiFieldDiffValue(field: string, value: number | null): string {
  if (KPI_DURATION_FIELDS.has(field)) return formatKpiImportDurationHours(value);
  if (field === "slaPercent") {
    if (value == null) return "—";
    return formatFreshdeskPercent({ value, noData: false });
  }
  if (value == null) return "—";
  if (field.startsWith("csat") || field === "reopened") {
    return formatNumber(value, 0);
  }
  return String(value);
}
