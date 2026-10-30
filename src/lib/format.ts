const IST = 5.5 * 60 * 60 * 1000;

export function weekStartKey(date = new Date()) {
  const ist = new Date(date.getTime() + IST);
  const day = ist.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  ist.setUTCDate(ist.getUTCDate() - diff);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function formatWeek(weekStart: string) {
  const end = addDays(weekStart, 6);
  const fmt = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  };
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

/** ISO week number for a Monday week-start key (UTC calendar math on stored date). */
export function isoWeekNumber(weekStart: string): number {
  const [y, m, d] = weekStart.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Management compare / reporting label for a KPI week. */
export function formatReportingWeekLabel(weekStart: string) {
  return `Week ${isoWeekNumber(weekStart)} : ${formatWeek(weekStart)}`;
}

/** Management compare label for a KPI month. */
export function formatReportingMonthLabel(month: string) {
  return `Month : ${formatMonth(month)}`;
}

export function formatComparePeriodLabel(periodType: "weekly" | "monthly", key: string) {
  return periodType === "weekly" ? formatReportingWeekLabel(key) : formatReportingMonthLabel(key);
}

/** Monday (IST) of the week containing `date` — use for default period filters. */
export function currentWeekStart(date = new Date()) {
  return weekStartKey(date);
}

/** Monday start of the most recently completed ISO week (IST). */
export function lastCompletedWeekStart(date = new Date()) {
  return addDays(weekStartKey(date), -7);
}

/**
 * Recent Monday week-start keys (IST), **newest first** (index 0 = current week).
 * Prefer `defaultWeeklyPeriodStart()` for filter defaults — not the last entry in this list.
 */
export function recentWeeks(count = 8) {
  const current = weekStartKey();
  return Array.from({ length: count }, (_, index) => addDays(current, -7 * (count - 1 - index))).reverse();
}

/** Default week for period filters — current ISO week (Monday IST). */
export function defaultWeeklyPeriodStart(date = new Date()) {
  return currentWeekStart(date);
}

export function monthKey(date = new Date()) {
  const ist = new Date(date.getTime() + IST);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function recentMonths(count = 12) {
  const [startY, startM] = monthKey().split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(Date.UTC(startY, startM - 1 - (count - 1 - index), 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
}

/** Calendar month immediately before `YYYY-MM`. */
export function previousMonthKey(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Prior reporting period key (weekly −7d, monthly −1 month). */
export function previousPeriodKey(periodType: "weekly" | "monthly", key: string): string {
  if (periodType === "weekly") return addDays(key, -7);
  return previousMonthKey(key);
}

/** Monday week-start keys for compare pickers (newest first). */
export function historicalWeekStarts(count = 52) {
  const current = weekStartKey();
  return Array.from({ length: count }, (_, index) => addDays(current, -7 * index));
}

/** Month keys for compare pickers (newest first). */
export function historicalMonthKeys(count = 36) {
  return recentMonths(count).reverse();
}

/** Display a stored `YYYY-MM-DD` calendar date (UTC semantics). */
export function formatCalendarDate(key?: string | null) {
  if (!key) return "—";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Mintlify / publication timestamps (ISO), not calendar `YYYY-MM-DD` keys. */
export function formatPublicationTimestamp(iso?: string | null) {
  if (!iso) return "Not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not recorded";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatDurationHours(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "N/A";
  const totalSeconds = Math.round(value * 3600);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

export function formatDurationHoursGoal(value: number) {
  return `≤ ${formatDurationHours(value)}`;
}

/** Today's calendar date in IST as `YYYY-MM-DD`. */
export function istDateKey(date = new Date()) {
  const ist = new Date(date.getTime() + IST);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type Metric = {
  value: number | null;
  freshdeskValue: number | null;
  source: "freshdesk" | "manual" | "calculated" | "admin";
  provenance: "live" | "seed" | "user";
  overridden?: boolean;
};

export function sourceLabel(metric?: Metric | null) {
  if (!metric) return "Unknown";
  if (metric.source === "admin") return "Admin override";
  if (metric.source === "manual") return "Manual";
  if (metric.source === "calculated") return "Calculated";
  if (metric.provenance === "seed") return "Freshdesk sample";
  return "Freshdesk";
}
