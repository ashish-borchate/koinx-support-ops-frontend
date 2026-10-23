export type SlaUrgency = "neutral" | "safe" | "warning" | "overdue";

export function taskCardUrgencyClass(urgency: SlaUrgency | undefined): string {
  const base = "border border-border";
  switch (urgency) {
    case "safe":
      return `${base} border-l-[3px] border-l-emerald-500/80`;
    case "warning":
      return `${base} border-l-[3px] border-l-amber-500/75`;
    case "overdue":
      return `${base} border-l-[3px] border-l-red-600/80`;
    default:
      return base;
  }
}

/** Dashboard task board cards only — subtle urgency surface tint. */
export function dashboardTaskUrgencySurface(urgency: SlaUrgency | undefined): string {
  switch (urgency) {
    case "warning":
      return "bg-amber-50/50 dark:bg-amber-950/15";
    case "overdue":
      return "bg-red-50/40 dark:bg-red-950/12";
    default:
      return "";
  }
}
