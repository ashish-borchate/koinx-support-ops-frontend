/** Set true to show Weekly Performance Review on Performance Center again. */
export const PERFORMANCE_CENTER_WEEKLY_REVIEWS_ENABLED = false;

import type { MetricDrillDown } from "./types";

export const METRIC_TABS: { id: MetricDrillDown; label: string }[] = [
  { id: "pg-reviews", label: "Product Guide Reviews" },
  { id: "pg-compliance", label: "Product Guide Compliance" },
  { id: "feedback", label: "Product Feedback" },
  { id: "ri-resolved", label: "Reported Issues Resolved" },
  { id: "qa", label: "QA Reviews" },
  { id: "kpi", label: "KPI Scorecard" },
];

export function buildAgentDashboardQueryString(
  agentId: string,
  preset: string,
  customFrom: string,
  customTo: string,
  timelineLimit = 8,
) {
  const p = new URLSearchParams({ agentId, preset, timelineLimit: String(timelineLimit) });
  if (preset === "custom" && customFrom && customTo) {
    p.set("from", customFrom);
    p.set("to", customTo);
  }
  return p.toString();
}
