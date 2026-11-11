import { useMemo } from "react";
import { eachDateKey } from "@/lib/ist-calendar-grid";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type DayCell = { date: string; created: number; resolved: number };

export type CalendarActivityKind = "created" | "resolved";

export function SupportAnalyticsActivityCalendar({
  from,
  to,
  daily,
  selectedDate,
  activityKind,
  onPick,
}: {
  from: string;
  to: string;
  daily: DayCell[];
  selectedDate: string | null;
  activityKind: CalendarActivityKind;
  onPick: (date: string | null, kind: CalendarActivityKind) => void;
}) {
  const map = useMemo(() => new Map(daily.map((d) => [d.date, d])), [daily]);
  const dates = useMemo(() => eachDateKey(from, to), [from, to]);
  const max = useMemo(() => Math.max(1, ...daily.map((d) => Math.max(d.created, d.resolved))), [daily]);

  return (
    <div className="space-y-2">
      <section className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-sky-500/80" /> Created — click count
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-500/80" /> Resolved — click count
        </span>
      </section>
      <div className="grid grid-cols-7 gap-1 sm:grid-cols-10 md:grid-cols-14">
        {dates.map((date) => {
          const row = map.get(date) || { date, created: 0, resolved: 0 };
          const intensity = Math.max(row.created, row.resolved) / max;
          const inRange = date >= from && date <= to;
          const active = selectedDate === date;
          return (
            <div
              key={date}
              className={cn(
                "flex min-h-[3.25rem] flex-col items-center justify-center rounded-md border px-0.5 py-1 text-[10px] transition",
                inRange ? "border-border" : "border-transparent opacity-40",
                active ? "ring-2 ring-primary" : "",
              )}
              style={{
                backgroundColor: `color-mix(in srgb, rgb(14 165 233) ${Math.round(intensity * 55)}%, transparent)`,
              }}
            >
              <span className="tabular-nums text-foreground">{date.slice(8)}</span>
              <button
                type="button"
                title={`${date} — created ${row.created}`}
                onClick={() => {
                  if (row.created > 0) onPick(date, "created");
                }}
                className={cn(
                  "tabular-nums text-sky-700 hover:underline dark:text-sky-300",
                  active && activityKind === "created" ? "font-semibold underline" : "",
                )}
              >
                +{formatNumber(row.created)}
              </button>
              <button
                type="button"
                title={`${date} — resolved ${row.resolved}`}
                onClick={() => {
                  if (row.resolved > 0) onPick(date, "resolved");
                }}
                className={cn(
                  "tabular-nums text-emerald-700 hover:underline dark:text-emerald-300",
                  active && activityKind === "resolved" ? "font-semibold underline" : "",
                )}
              >
                ✓{formatNumber(row.resolved)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
