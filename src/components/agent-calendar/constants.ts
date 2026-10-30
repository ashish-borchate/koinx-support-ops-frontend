export const TEAM_CALENDAR_ID = "__team__";

export const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type AvailabilityStatus =
  | "working"
  | "holiday"
  | "weekly_off"
  | "leave"
  | "pending_leave"
  | "non_working";

export function statusBadgeClass(status: AvailabilityStatus | string) {
  switch (status) {
    case "working":
      return "bg-emerald-500/12 text-emerald-950 border-emerald-600/25 dark:bg-emerald-500/15 dark:text-emerald-50 dark:border-emerald-400/30";
    case "weekly_off":
      return "bg-slate-200/90 text-slate-900 border-slate-400/40 dark:bg-slate-500/15 dark:text-slate-100 dark:border-slate-400/30";
    case "leave":
      return "bg-amber-500/12 text-amber-950 border-amber-600/25 dark:bg-amber-500/15 dark:text-amber-50 dark:border-amber-400/30";
    case "pending_leave":
      return "bg-background text-muted-foreground border-dashed border-muted-foreground/50";
    case "holiday":
      return "bg-rose-500/12 text-rose-950 border-rose-600/25 dark:bg-rose-500/15 dark:text-rose-50 dark:border-rose-400/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}
