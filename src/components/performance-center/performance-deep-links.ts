import { weekStartKey } from "@/lib/format";
import type { AgentDashboard } from "./types";

/** Monday (IST) week-start for a calendar date key. */
export function istWeekStartFromDateKey(dateIst: string) {
  const [y, m, d] = dateIst.split("-").map(Number);
  return weekStartKey(new Date(Date.UTC(y, m - 1, d)));
}

function reportingParams(data: AgentDashboard) {
  const preset = data.period.preset;
  if (data.kpi.grain === "weekly" && data.kpi.periodKey) {
    return { periodType: "weekly" as const, week: data.kpi.periodKey, month: null };
  }
  if (data.kpi.grain === "monthly" && data.kpi.periodKey) {
    return { periodType: "monthly" as const, week: null, month: data.kpi.periodKey };
  }
  if (preset === "this_month" || preset === "last_month") {
    return { periodType: "monthly" as const, week: null, month: data.period.startIst.slice(0, 7) };
  }
  return {
    periodType: "weekly" as const,
    week: istWeekStartFromDateKey(data.period.startIst),
    month: null,
  };
}

export function kpiPerformanceHref(data: AgentDashboard) {
  const p = new URLSearchParams({ agentId: data.agent.id });
  const r = reportingParams(data);
  p.set("periodType", r.periodType);
  if (r.week) p.set("week", r.week);
  if (r.month) p.set("month", r.month);
  return `/kpi?${p.toString()}`;
}

export function qaModuleHref(data: AgentDashboard, reviewId?: string) {
  if (reviewId) return `/qa/${reviewId}`;
  const p = new URLSearchParams({ agentId: data.agent.id });
  const r = reportingParams(data);
  p.set("periodType", r.periodType);
  if (r.week) p.set("week", r.week);
  if (r.month) p.set("month", r.month);
  return `/qa?${p.toString()}`;
}

export function productFeedbackHref(data: AgentDashboard) {
  const p = new URLSearchParams({ agentId: data.agent.id });
  return `/product-feedback/tracker?${p.toString()}`;
}
