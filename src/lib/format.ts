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

export function recentWeeks(count = 8) {
  const current = weekStartKey();
  return Array.from({ length: count }, (_, index) => addDays(current, -7 * (count - 1 - index))).reverse();
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
