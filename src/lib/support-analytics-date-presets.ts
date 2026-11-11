export type DatePresetId = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "custom";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function calendarDateIst(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIst(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function resolveDatePreset(preset: DatePresetId, now = new Date()): { from: string; to: string } {
  const today = calendarDateIst(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDaysIst(today, -1);
      return { from: y, to: y };
    }
    case "last7":
      return { from: addDaysIst(today, -6), to: today };
    case "last30":
      return { from: addDaysIst(today, -29), to: today };
    case "thisMonth": {
      const [y, m] = today.split("-");
      return { from: `${y}-${m}-01`, to: today };
    }
    default:
      return { from: today, to: today };
  }
}
