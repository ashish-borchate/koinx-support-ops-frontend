export type KpiMetricTone = "success" | "warning" | "critical" | "neutral";

export const kpiToneBorder: Record<KpiMetricTone, string> = {
  success: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-amber-500/35 bg-amber-500/5",
  critical: "border-rose-500/35 bg-rose-500/5",
  neutral: "border-border/60 bg-card",
};

export function compareKpiTone(
  value: number | null,
  goal: number | null,
  direction: "lte" | "gte",
): KpiMetricTone {
  if (value == null || goal == null) return "neutral";
  const ok = direction === "lte" ? value <= goal : value >= goal;
  if (ok) return "success";
  const gap = direction === "lte" ? (value - goal) / goal : (goal - value) / goal;
  return gap > 0.15 ? "critical" : "warning";
}

export function earnedPointsTone(points: number | null, weight: number): KpiMetricTone {
  if (points == null || weight <= 0) return "neutral";
  const ratio = points / weight;
  if (ratio >= 0.95) return "success";
  if (ratio >= 0.55) return "warning";
  return "critical";
}
