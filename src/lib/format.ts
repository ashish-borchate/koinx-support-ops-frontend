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

/** Monday (IST) of the week containing `date` — use for default period filters. */
export function currentWeekStart(date = new Date()) {
  return weekStartKey(date);
}

/** Monday start of the most recently completed ISO week (IST). */
export function lastCompletedWeekStart(date = new Date()) {
  return addDays(weekStartKey(date), -7);
}

export function recentWeeks(count = 8) {
  const current = weekStartKey();
  return Array.from({ length: count }, (_, index) => addDays(current, -7 * (count - 1 - index))).reverse();
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
