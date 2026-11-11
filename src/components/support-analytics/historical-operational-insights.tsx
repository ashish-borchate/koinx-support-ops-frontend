import { formatCalendarDate, formatNumber } from "@/lib/format";

type Advanced = {
  volume: {
    createdInRange: number;
    resolvedInRange: number;
    netChange: number;
    dailyTrend: { date: string; created: number; resolved: number; net: number }[];
    weekdayCreated: { weekday: number; created: number }[];
    hourCreatedHeatmap: { hourIst: number; created: number }[];
    unusualDay?: { date: string; created: number; resolved: number; net: number } | null;
  };
  backlogAging: { buckets: { bucket: string; count: number }[] };
};

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function HistoricalOperationalInsights({ advanced }: { advanced: Advanced }) {
  const trend = advanced.volume.dailyTrend;
  if (!trend.length) return null;

  const mid = Math.floor(trend.length / 2);
  const firstHalf = trend.slice(0, Math.max(1, mid));
  const secondHalf = trend.slice(Math.max(1, mid));
  const createdFirst = firstHalf.reduce((a, d) => a + d.created, 0);
  const createdSecond = secondHalf.reduce((a, d) => a + d.created, 0);
  const inflow =
    createdSecond > createdFirst * 1.1
      ? "Incoming volume rose in the second half of the period."
      : createdSecond < createdFirst * 0.9
        ? "Incoming volume eased in the second half of the period."
        : "Incoming volume was relatively steady across the period.";

  const pace =
    advanced.volume.resolvedInRange >= advanced.volume.createdInRange
      ? "Resolutions kept pace with or exceeded creations in this reporting window."
      : "Creations outpaced resolutions — backlog may grow if this continues.";

  const peakHour = [...advanced.volume.hourCreatedHeatmap].sort((a, b) => b.created - a.created)[0];
  const peakWeekday = [...advanced.volume.weekdayCreated].sort((a, b) => b.created - a.created)[0];
  const topAging = [...advanced.backlogAging.buckets].sort((a, b) => b.count - a.count)[0];
  const peakDay = advanced.volume.unusualDay;

  const cards = [
    { title: "Inflow", body: inflow },
    { title: "Resolution pace", body: pace },
    peakDay && peakDay.created > 0
      ? {
          title: "Busiest day",
          body: `${formatCalendarDate(peakDay.date)} — ${formatNumber(peakDay.created)} created, ${formatNumber(peakDay.resolved)} resolved.`,
        }
      : null,
    peakWeekday && peakWeekday.created > 0
      ? {
          title: "Peak weekday (IST)",
          body: `${WEEKDAY[peakWeekday.weekday - 1] ?? "?"} — ${formatNumber(peakWeekday.created)} tickets created in period.`,
        }
      : null,
    peakHour && peakHour.created > 0
      ? {
          title: "Peak hour (IST)",
          body: `${String(peakHour.hourIst).padStart(2, "0")}:00 — ${formatNumber(peakHour.created)} tickets created in period.`,
        }
      : null,
    topAging && topAging.count > 0
      ? {
          title: "Open backlog age (latest import)",
          body: `Most open tickets sit in the “${topAging.bucket}” bucket (${formatNumber(topAging.count)}). Snapshot only — not daily history.`,
        }
      : null,
  ].filter(Boolean) as { title: string; body: string }[];

  if (!cards.length) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Operational insights</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.title} className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.title}</p>
            <p className="mt-1 leading-snug text-foreground">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
